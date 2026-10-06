const prisma = require("../utils/prismaClient");
const {
  JAM_MASUK_STANDAR_DEFAULT,
  bagianWaktuWIB,
  tanggalHariIniWIBString,
  parseJam,
} = require("../utils/waktuIndonesia");
const { ambilSetHariLibur } = require("../utils/hariLibur");

const STATUS_VALID = new Set([
  "tepat_waktu",
  "telat",
  "alpha",
  "izin",
  "sakit",
  "cuti",
  "urgent",
]);

const STATUS_TAMPILAN = {
  tepat_waktu: "Tepat Waktu",
  telat: "Telat",
  alpha: "Alpha",
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
  urgent: "Urgent",
  belum_absen: "Belum Absen",
};

const WARNA = {
  navy: "FF16233D",
  header: "FF1F4E79",
  garis: "FFD9E0E7",
  teks: "FF243247",
  abu: "FFF7F9FB",
  putih: "FFFFFFFF",
  hijauMuda: "FFEAF5EF",
  kuningMuda: "FFFFF4CC",
  merahMuda: "FFFDECEC",
  biruMuda: "FFEAF2FF",
};

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

function tanggalUTC(tanggal) {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

function tambahHari(tanggal) {
  const hasil = new Date(tanggal.getTime());
  hasil.setUTCDate(hasil.getUTCDate() + 1);
  return hasil;
}

function daftarTanggal(mulai, selesai) {
  const hasil = [];
  let cursor = tanggalUTC(mulai);
  const akhir = tanggalUTC(selesai);

  while (cursor <= akhir) {
    hasil.push(new Date(cursor.getTime()));
    cursor = tambahHari(cursor);
  }

  return hasil;
}

function formatTanggalIndonesia(tanggal) {
  const bagian = bagianWaktuWIB(tanggal);
  return `${String(bagian.hari).padStart(2, "0")}-${String(
    bagian.bulan,
  ).padStart(2, "0")}-${bagian.tahun}`;
}

function formatJam(tanggal) {
  if (!tanggal) return "-";
  const bagian = bagianWaktuWIB(tanggal);
  return `${String(bagian.jam).padStart(2, "0")}:${String(
    bagian.menit,
  ).padStart(2, "0")}`;
}

function formatTanggalFile(tanggal) {
  const bagian = bagianWaktuWIB(tanggal);
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return String(bagian.hari).padStart(2, "0") + bulan[bagian.bulan - 1] + bagian.tahun;
}

function punyaKeterangan(nilai) {
  return nilai !== null && nilai !== undefined && String(nilai).trim() !== "";
}

function kodeDariStatus(status, izinItem) {
  if (status === "tepat_waktu") return "H";
  if (status === "telat") return "T";
  if (status === "cuti" || izinItem?.jenis === "cuti") return "C";
  if (status === "sakit" || izinItem?.jenis === "sakit") {
    return punyaKeterangan(izinItem?.fotoSurat) ? "S" : "SX";
  }
  if (
    status === "izin" ||
    status === "urgent" ||
    izinItem?.jenis === "izin" ||
    izinItem?.jenis === "urgent"
  ) {
    return "I";
  }
  if (status === "alpha") return "A";
  return "";
}

function namaBulanIndonesia(bulan) {
  return ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][bulan - 1];
}

function excelColumnName(number) {
  let value = number;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function statusDariAbsensi(absensi, jamMasukStandar) {
  if (!absensi) return "alpha";

  const statusFinal = String(absensi.statusFinal || "").trim();
  if (STATUS_VALID.has(statusFinal)) return statusFinal;

  const statusOtomatis = String(absensi.statusOtomatis || "").trim();
  if (STATUS_VALID.has(statusOtomatis)) return statusOtomatis;

  if (!absensi.jamMasuk) return "alpha";

  const batasMenit = parseJam(jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT);
  const waktuMasuk = bagianWaktuWIB(absensi.jamMasuk);
  const masukMenit = waktuMasuk.jam * 60 + waktuMasuk.menit;

  return masukMenit > batasMenit ? "telat" : "tepat_waktu";
}

function hitungKeterlambatan(absensi, jamMasukStandar) {
  if (!absensi?.jamMasuk) return 0;

  const batasMenit = parseJam(jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT);
  const waktuMasuk = bagianWaktuWIB(absensi.jamMasuk);
  const masukMenit = waktuMasuk.jam * 60 + waktuMasuk.menit;

  return Math.max(masukMenit - batasMenit, 0);
}

function formatKeterlambatan(menit) {
  if (!menit) return "-";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0) return `${jam} jam ${sisa} menit`;
  return `${sisa} menit`;
}

function isiWarnaStatus(cell, status) {
  const fill =
    status === "Tepat Waktu"
      ? WARNA.hijauMuda
      : status === "Telat"
        ? WARNA.kuningMuda
        : status === "Alpha"
          ? WARNA.merahMuda
          : status === "Belum Absen"
            ? WARNA.abu
            : WARNA.biruMuda;

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
  cell.font = {
    name: "Aptos",
    size: 10,
    bold: true,
    color: { argb: WARNA.teks },
  };
}

function gayaHeader(row, jumlahKolom) {
  for (let index = 1; index <= jumlahKolom; index += 1) {
    const cell = row.getCell(index);
    cell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: WARNA.putih },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: WARNA.header },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: WARNA.garis } },
      left: { style: "thin", color: { argb: WARNA.garis } },
      bottom: { style: "thin", color: { argb: WARNA.garis } },
      right: { style: "thin", color: { argb: WARNA.garis } },
    };
  }
  row.height = 30;
}

function gayaData(cell, { horizontal = "left", wrapText = false, bold = false } = {}) {
  cell.font = {
    name: "Aptos",
    size: 10,
    bold,
    color: { argb: WARNA.teks },
  };
  cell.alignment = {
    horizontal,
    vertical: "middle",
    wrapText,
  };
  cell.border = {
    top: { style: "thin", color: { argb: WARNA.garis } },
    left: { style: "thin", color: { argb: WARNA.garis } },
    bottom: { style: "thin", color: { argb: WARNA.garis } },
    right: { style: "thin", color: { argb: WARNA.garis } },
  };
}

async function exportRekapAbsensi(req, res) {
  try {
    const hariIni = tanggalHariIniWIBString();
    const tanggalMulai = normalisasiTanggal(req.query?.tanggalMulai) || hariIni;
    const tanggalSelesai = normalisasiTanggal(req.query?.tanggalSelesai) || tanggalMulai;

    if (!tanggalMulai || !tanggalSelesai) {
      return res.status(400).json({ pesan: "Rentang tanggal rekap tidak valid." });
    }
    if (tanggalMulai > tanggalSelesai) {
      return res.status(400).json({ pesan: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai." });
    }
    if (tanggalSelesai > hariIni) {
      return res.status(400).json({ pesan: "Rekap tidak boleh mencakup tanggal yang akan datang." });
    }

    const tanggalAwal = tanggalUTC(tanggalMulai);
    const tanggalAkhir = tanggalUTC(tanggalSelesai);
    const jumlahHari = Math.floor((tanggalAkhir - tanggalAwal) / (24 * 60 * 60 * 1000)) + 1;
    if (jumlahHari > 31) {
      return res.status(400).json({ pesan: "Rentang rekap maksimal 31 hari per file." });
    }

    // Kolom tanggal di PostgreSQL adalah DATE. Gunakan batas tanggal UTC
    // pada tengah malam dan batas akhir eksklusif agar filter tidak bergantung
    // pada konversi timezone timestamp WIB.
    const rangeStart = tanggalUTC(tanggalMulai);
    const rangeEndExclusive = tambahHari(tanggalUTC(tanggalSelesai));

    const [karyawan, absensi, pengajuanDisetujui, pengaturan, setHariLibur] = await Promise.all([
      prisma.pengguna.findMany({
        where: { peran: "karyawan" },
        select: { id: true, nama: true, jabatan: true, divisi: true, kantor: { select: { namaKantor: true } } },
        orderBy: { nama: "asc" },
      }),
      prisma.absensi.findMany({
        where: { tanggal: { gte: rangeStart, lt: rangeEndExclusive }, pengguna: { peran: "karyawan" } },
        select: { penggunaId: true, tanggal: true, jamMasuk: true, jamPulang: true, statusOtomatis: true, statusFinal: true, keterangan: true, catatanAdmin: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }],
      }),
      prisma.pengajuanIzin.findMany({
        where: { tanggal: { gte: rangeStart, lt: rangeEndExclusive }, status: "disetujui", pengguna: { peran: "karyawan" } },
        select: { id: true, penggunaId: true, tanggal: true, jenis: true, keterangan: true, fotoSurat: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }, { id: "asc" }],
      }),
      prisma.pengaturanPotongan.findUnique({ where: { id: 1 }, select: { jamMasukStandar: true } }),
      Promise.all(
        [...new Set([Number(tanggalMulai.slice(0, 4)), Number(tanggalSelesai.slice(0, 4))])].map((tahun) => ambilSetHariLibur(tahun)),
      ).then((setList) => new Set(setList.flatMap((setTahun) => [...setTahun]))),
    ]);

    const jamMasukStandar = pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    // Satu baris Excel hanya boleh mewakili satu karyawan unik.
    // Prisma sudah mengembalikan ID unik, tetapi kita deduplikasi lagi
    // sebagai pengaman agar tidak pernah ada baris karyawan ganda.
    const karyawanUnik = Array.from(
      new Map(karyawan.map((item) => [String(item.id), item])).values(),
    );

    const petaAbsensi = new Map();
    for (const item of absensi) {
      const tanggalKey = item.tanggal instanceof Date ? item.tanggal.toISOString().slice(0, 10) : String(item.tanggal).slice(0, 10);
      petaAbsensi.set(item.penggunaId + "_" + tanggalKey, item);
    }
    const petaIzin = new Map();
    for (const item of pengajuanDisetujui) {
      const tanggalKey =
        item.tanggal instanceof Date
          ? item.tanggal.toISOString().slice(0, 10)
          : String(item.tanggal).slice(0, 10);
      const key = item.penggunaId + "_" + tanggalKey;
      const sebelumnya = petaIzin.get(key);

      if (!sebelumnya) {
        petaIzin.set(key, item);
        continue;
      }

      // Satu karyawan + satu tanggal tetap hanya dihitung satu kali.
      // Jika ada data pengajuan ganda, prioritaskan cuti > sakit > jenis lain.
      const prioritas = { cuti: 3, sakit: 2, izin: 1, urgent: 1 };
      const pilih = (prioritas[item.jenis] || 0) > (prioritas[sebelumnya.jenis] || 0)
        ? item
        : sebelumnya;

      petaIzin.set(key, {
        ...pilih,
        keterangan:
          punyaKeterangan(sebelumnya.keterangan) || punyaKeterangan(item.keterangan)
            ? (punyaKeterangan(pilih.keterangan)
                ? pilih.keterangan
                : sebelumnya.keterangan || item.keterangan)
            : "",
        fotoSurat: pilih.fotoSurat || sebelumnya.fotoSurat || item.fotoSurat || null,
      });
    }

    const tanggalList = daftarTanggal(tanggalMulai, tanggalSelesai);
    const hariKerjaList = tanggalList.filter((tanggal) => {
      const tanggalKey = tanggal.toISOString().slice(0, 10);
      const hari = tanggal.getUTCDay();
      return hari !== 0 && hari !== 6 && !setHariLibur.has(tanggalKey);
    });
    const jumlahHariKerja = hariKerjaList.length;
    const jumlahHariLibur = Math.max(jumlahHari - jumlahHariKerja, 0);

    const ExcelJS = require("exceljs");

    // Data Harian menjadi sumber detail. Hari kosong tidak dipaksa menjadi
    // alpha karena database tidak punya bukti bahwa karyawan memang alpha.
    // Status alpha yang memang dicatat Admin tetap menjadi "A".
    const detailHarianPerKaryawan = karyawanUnik.map((item) => {
      const prefix = item.id + "_";
      const kodeHarian = tanggalList.map((tanggal) => {
        const tanggalKey = tanggal.toISOString().slice(0, 10);
        const absensiItem = petaAbsensi.get(prefix + tanggalKey);
        const izinItem = petaIzin.get(prefix + tanggalKey);

        const punyaCap = Boolean(absensiItem?.jamMasuk || absensiItem?.jamPulang);
        if (punyaCap) {
          const status = statusDariAbsensi(absensiItem, jamMasukStandar);
          return status === "telat" ? "T" : "H";
        }

        if (absensiItem) {
          const kodeStatus = kodeDariStatus(
            statusDariAbsensi(absensiItem, jamMasukStandar),
            izinItem,
          );
          if (kodeStatus) return kodeStatus;

          const adaKeterangan = punyaKeterangan(absensiItem.keterangan);
          if (adaKeterangan) return "I";
        }

        if (izinItem) {
          const kodeIzin = kodeDariStatus(null, izinItem);
          if (kodeIzin) return kodeIzin;
        }

        const hari = tanggal.getUTCDay();
        if (hari === 0 || hari === 6 || setHariLibur.has(tanggalKey)) {
          return "L";
        }

        return "";
      });

      const hitung = (kode) =>
        kodeHarian.filter((nilai) => nilai === kode).length;

      const jumlahKehadiran = hitung("H") + hitung("T");
      const jumlahTelat = hitung("T");
      const jumlahAdaKeterangan = hitung("I");
      const jumlahTanpaKeterangan = hitung("A");
      const jumlahCuti = hitung("C");
      const jumlahSakitAdaSurat = hitung("S");
      const jumlahSakitTanpaSurat = hitung("SX");

      return {
        id: item.id,
        nama: item.nama || "-",
        kodeHarian,
        jumlahKehadiran,
        jumlahTelat,
        jumlahUangMakan: Math.max(jumlahKehadiran - jumlahTelat, 0),
        jumlahAdaKeterangan,
        jumlahTanpaKeterangan,
        lembur: 0,
        cuti: jumlahCuti,
        sakitAdaSurat: jumlahSakitAdaSurat,
        sakitTanpaSurat: jumlahSakitTanpaSurat,
        jumlahHC:
          jumlahKehadiran +
          jumlahAdaKeterangan +
          jumlahTanpaKeterangan +
          jumlahCuti +
          jumlahSakitAdaSurat +
          jumlahSakitTanpaSurat,
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zaman Teknindo";
    workbook.created = new Date();

    const COLORS = {
      navy: "FF2E4E7E",
      green: "FF2E7D32",
      blue: "FF1565C0",
      orange: "FFE65100",
      purple: "FF6A1B9A",
      red: "FFC62828",
      brown: "FF795548",
      teal: "FF00695C",
      lightBlue: "FFE9F1F9",
      lightGray: "FFE6E9ED",
      grid: "FF808080",
      text: "FF1F2937",
      white: "FFFFFFFF",
    };

    const border = {
      top: { style: "thin", color: { argb: COLORS.grid } },
      left: { style: "thin", color: { argb: COLORS.grid } },
      bottom: { style: "thin", color: { argb: COLORS.grid } },
      right: { style: "thin", color: { argb: COLORS.grid } },
    };

    // =========================
    // SHEET 1 — REKAP ABSENSI
    // =========================
    const sheet = workbook.addWorksheet("Rekap Absensi", {
      views: [{ state: "frozen", ySplit: 6, xSplit: 2 }],
    });
    sheet.showGridLines = false;
    sheet.properties.defaultRowHeight = 22;

    sheet.mergeCells("A1:Q1");
    sheet.getCell("A1").value = "REKAP DATA KEHADIRAN KARYAWAN";
    sheet.getCell("A1").font = {
      name: "Aptos Display",
      size: 16,
      bold: true,
      color: { argb: COLORS.white },
    };
    sheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(1).height = 28;

    const bagianAwal = bagianWaktuWIB(tanggalAwal);
    const bagianAkhir = bagianWaktuWIB(tanggalAkhir);
    sheet.mergeCells("A2:Q2");
    sheet.getCell("A2").value =
      "PERIODE BULAN " +
      namaBulanIndonesia(bagianAkhir.bulan).toUpperCase() +
      " " +
      bagianAkhir.tahun +
      "  (" +
      formatTanggalIndonesia(tanggalAwal) +
      " – " +
      formatTanggalIndonesia(tanggalAkhir) +
      ")  •  " +
      jumlahHari +
      " Hari Kalender";
    sheet.getCell("A2").font = {
      name: "Aptos",
      size: 10.5,
      italic: true,
      color: { argb: COLORS.white },
    };
    sheet.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(2).height = 23;

    for (const rowNum of [1, 2]) {
      for (let col = 1; col <= 17; col += 1) {
        sheet.getCell(rowNum, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.navy },
        };
      }
    }

    [
      "A4:A6",
      "B4:B6",
      "C4:C6",
      "D4:D6",
      "E4:G4",
      "H4:H6",
      "I4:I6",
      "J4:J6",
      "K4:L4",
      "M4:M6",
      "N4:N6",
      "O4:P4",
      "Q4:Q6",
    ].forEach((merge) => sheet.mergeCells(merge));

    const topHeaders = {
      A4: "NO",
      B4: "NAMA",
      C4: "TMK",
      E4: "JUMLAH HAK CUTI",
      H4: "JLH KEHADIRAN",
      I4: "TERLAMBAT",
      J4: "JLH UANG MAKAN\nYANG DIBAYARKAN",
      K4: "TIDAK MASUK",
      M4: "LEMBUR",
      N4: "CUTI",
      O4: "SAKIT",
      Q4: "JLH HC",
    };
    Object.entries(topHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const subHeaders = {
      E5: "HC\n2024/2025",
      F5: "HC\n2025/2026",
      G5: "JLH HC SDH\nDIJALANI/DIPINJAM",
      K5: "ADA KET",
      L5: "TANPA KET",
      O5: "ADA SRT",
      P5: "TANPA SRT",
    };
    Object.entries(subHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const groupFills = {
      1: COLORS.navy,
      2: COLORS.navy,
      3: COLORS.navy,
      4: COLORS.navy,
      5: COLORS.green,
      6: COLORS.green,
      7: COLORS.green,
      8: COLORS.blue,
      9: COLORS.orange,
      10: COLORS.purple,
      11: COLORS.red,
      12: COLORS.red,
      13: COLORS.brown,
      14: COLORS.brown,
      15: COLORS.brown,
      16: COLORS.brown,
      17: COLORS.teal,
    };

    for (let rowNum = 4; rowNum <= 6; rowNum += 1) {
      for (let col = 1; col <= 17; col += 1) {
        const cell = sheet.getCell(rowNum, col);
        cell.border = border;
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.font = {
          name: "Aptos",
          size: 9.5,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: groupFills[col] || COLORS.navy },
        };
      }
    }

    sheet.getRow(4).height = 31;
    sheet.getRow(5).height = 40;
    sheet.getRow(6).height = 14;

    const dataStartRow = 7;
    const lastDailyColLetter = excelColumnName(2 + jumlahHari);
    let rowNumber = dataStartRow;

    for (let index = 0; index < detailHarianPerKaryawan.length; index += 1) {
        const item = detailHarianPerKaryawan[index];
        const row = sheet.getRow(rowNumber);
        const dailyRow = dataStartRow + index;
        const dailyRange = "'Data Harian'!$C" + dailyRow + ":$" + lastDailyColLetter + dailyRow;

        row.getCell(1).value = index + 1;
        row.getCell(2).value = item.nama;

        row.getCell(3).value = null;
        row.getCell(4).value = null;
        row.getCell(5).value = null;
        row.getCell(6).value = null;
        row.getCell(7).value = null;

        row.getCell(8).value = {
          formula: "COUNTIF(" + dailyRange + ",\"H\")+COUNTIF(" + dailyRange + ",\"T\")",
          result: item.jumlahKehadiran,
        };
        row.getCell(9).value = {
          formula: "COUNTIF(" + dailyRange + ",\"T\")",
          result: item.jumlahTelat,
        };
        row.getCell(10).value = {
          formula: "MAX(0,H" + rowNumber + "-I" + rowNumber + ")",
          result: item.jumlahUangMakan,
        };
        row.getCell(11).value = {
          formula: "COUNTIF(" + dailyRange + ",\"I\")",
          result: item.jumlahAdaKeterangan,
        };
        row.getCell(12).value = {
          formula: "COUNTIF(" + dailyRange + ",\"A\")",
          result: item.jumlahTanpaKeterangan,
        };
        row.getCell(13).value = Number(item.lembur || 0);
        row.getCell(14).value = {
          formula: "COUNTIF(" + dailyRange + ",\"C\")",
          result: item.cuti,
        };
        row.getCell(15).value = {
          formula: "COUNTIF(" + dailyRange + ",\"S\")",
          result: item.sakitAdaSurat,
        };
        row.getCell(16).value = {
          formula: "COUNTIF(" + dailyRange + ",\"SX\")",
          result: item.sakitTanpaSurat,
        };
        row.getCell(17).value = {
          formula:
            "SUM(H" +
            rowNumber +
            ",K" +
            rowNumber +
            ":L" +
            rowNumber +
            ",N" +
            rowNumber +
            ":P" +
            rowNumber +
            ")",
          result: item.jumlahHC,
        };

        const fill = index % 2 === 0 ? COLORS.white : COLORS.lightBlue;
        row.height = 22;

        for (let col = 1; col <= 17; col += 1) {
          const cell = row.getCell(col);
          cell.font = {
            name: "Aptos",
            size: 10,
            bold: false,
            color: { argb: COLORS.text },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fill },
          };
          cell.border = border;
          cell.alignment = {
            horizontal: col === 2 ? "left" : "center",
            vertical: "middle",
            wrapText: col === 2,
          };
        }

      rowNumber += 1;
    }

    const adaDataKaryawan = detailHarianPerKaryawan.length > 0;
    const lastDataRow = adaDataKaryawan ? rowNumber - 1 : dataStartRow;
    const totalRow = adaDataKaryawan ? rowNumber : dataStartRow + 1;

    sheet.mergeCells("A" + totalRow + ":G" + totalRow);
    sheet.getCell("A" + totalRow).value = "TOTAL";

    const totalPairs = [
      ["H", "jumlahKehadiran"],
      ["I", "jumlahTelat"],
      ["K", "jumlahAdaKeterangan"],
      ["L", "jumlahTanpaKeterangan"],
      ["N", "cuti"],
      ["O", "sakitAdaSurat"],
      ["P", "sakitTanpaSurat"],
      ["Q", "jumlahHC"],
    ];
    for (const [column, key] of totalPairs) {
      sheet.getCell(column + totalRow).value = {
        formula: "SUM(" + column + dataStartRow + ":" + column + lastDataRow + ")",
        result: detailHarianPerKaryawan.reduce(
          (sum, item) => sum + Number(item[key] || 0),
          0,
        ),
      };
    }
    sheet.getCell("J" + totalRow).value = {
      formula: "MAX(0,H" + totalRow + "-I" + totalRow + ")",
      result: Math.max(
        0,
        detailHarianPerKaryawan.reduce((sum, item) => sum + item.jumlahKehadiran, 0) -
          detailHarianPerKaryawan.reduce((sum, item) => sum + item.jumlahTelat, 0),
      ),
    };
    sheet.getCell("M" + totalRow).value = {
      formula: "SUM(M" + dataStartRow + ":M" + lastDataRow + ")",
      result: detailHarianPerKaryawan.reduce((sum, item) => sum + item.lembur, 0),
    };

    for (let col = 1; col <= 17; col += 1) {
      const cell = sheet.getCell(totalRow, col);
      cell.font = {
        name: "Aptos",
        size: 10.5,
        bold: true,
        color: { argb: COLORS.navy },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.lightBlue },
      };
      cell.border = border;
      cell.alignment = {
        horizontal: col === 1 ? "left" : "center",
        vertical: "middle",
      };
    }
    sheet.getRow(totalRow).height = 27;

    const footerStart = totalRow + 2;
    const footerLines = [
      "Jumlah Hari Kalender dalam Bulan " +
        namaBulanIndonesia(bagianAkhir.bulan) +
        " " +
        bagianAkhir.tahun +
        " (" +
        formatTanggalIndonesia(tanggalAwal) +
        " - " +
        formatTanggalIndonesia(tanggalAkhir) +
        ") : " +
        jumlahHari +
        " Hari",
      "Jumlah Hari Kerja Efektif dalam Bulan " +
        namaBulanIndonesia(bagianAkhir.bulan) +
        " " +
        bagianAkhir.tahun +
        " (" +
        formatTanggalIndonesia(tanggalAwal) +
        " - " +
        formatTanggalIndonesia(tanggalAkhir) +
        ") : " +
        jumlahHariKerja +
        " HKE",
      "Jumlah Hari Minggu, Libur dan Cuti Bersama Periode Bulan " +
        namaBulanIndonesia(bagianAkhir.bulan) +
        " " +
        bagianAkhir.tahun +
        " (" +
        formatTanggalIndonesia(tanggalAwal) +
        " - " +
        formatTanggalIndonesia(tanggalAkhir) +
        ") : " +
        String(jumlahHariLibur).padStart(2, "0") +
        " Hari",
      "(Hari Sabtu/Minggu dan tanggal yang tercatat pada master Hari Libur)",
    ];

    footerLines.forEach((footerText, index) => {
      const rowIndex = footerStart + index;
      sheet.mergeCells("A" + rowIndex + ":Q" + rowIndex);
      const cell = sheet.getCell("A" + rowIndex);
      cell.value = footerText;
      cell.font = {
        name: "Aptos",
        size: index < 3 ? 10 : 9,
        bold: index < 3,
        italic: index >= 3,
        color: { argb: index < 3 ? COLORS.navy : COLORS.text },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.lightBlue },
      };
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = border;
      sheet.getRow(rowIndex).height = index < 3 ? 23 : 20;
    });

    const signatureRow = footerStart + footerLines.length + 2;
    sheet.mergeCells("A" + signatureRow + ":D" + signatureRow);
    sheet.getCell("A" + signatureRow).value = "Dibuat Oleh,";
    sheet.getCell("A" + signatureRow).font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("A" + signatureRow).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("M" + signatureRow + ":Q" + signatureRow);
    sheet.getCell("N" + signatureRow).value = "Diketahui Oleh,";
    sheet.getCell("N" + signatureRow).font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("N" + signatureRow).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A" + (signatureRow + 1) + ":D" + (signatureRow + 1));
    sheet.getCell("A" + (signatureRow + 1)).value =
      "Pekanbaru, " + formatTanggalIndonesia(new Date());
    sheet.getCell("A" + (signatureRow + 1)).font = {
      name: "Aptos",
      size: 10,
      italic: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("A" + (signatureRow + 1)).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A" + (signatureRow + 7) + ":D" + (signatureRow + 7));
    sheet.getCell("A" + (signatureRow + 7)).value = "Zaman Teknindo";
    sheet.getCell("A" + (signatureRow + 7)).font = {
      name: "Aptos",
      size: 10,
      italic: true,
      bold: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("A" + (signatureRow + 7)).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("M" + (signatureRow + 7) + ":Q" + (signatureRow + 7));
    sheet.getCell("N" + (signatureRow + 7)).value = "R. Nuning Rosita R";
    sheet.getCell("N" + (signatureRow + 7)).font = {
      name: "Aptos",
      size: 10,
      italic: true,
      bold: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("N" + (signatureRow + 7)).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A" + (signatureRow + 8) + ":D" + (signatureRow + 8));
    sheet.getCell("A" + (signatureRow + 8)).value = "SPV. Umum & Personalia";
    sheet.getCell("A" + (signatureRow + 8)).font = {
      name: "Aptos",
      size: 9.5,
      italic: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("A" + (signatureRow + 8)).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("M" + (signatureRow + 8) + ":Q" + (signatureRow + 8));
    sheet.getCell("N" + (signatureRow + 8)).value = "Manager Financial";
    sheet.getCell("N" + (signatureRow + 8)).font = {
      name: "Aptos",
      size: 9.5,
      italic: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("N" + (signatureRow + 8)).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.columns = [
      { key: "no", width: 7 },
      { key: "nama", width: 32 },
      { key: "tmk", width: 14 },
      { key: "spacer", width: 4 },
      { key: "hakCuti", width: 17 },
      { key: "hc2425", width: 13 },
      { key: "hc2526", width: 13 },
      { key: "hcDipinjam", width: 19 },
      { key: "late", width: 13 },
      { key: "meal", width: 22 },
      { key: "adaKet", width: 12 },
      { key: "tanpaKet", width: 12 },
      { key: "lembur", width: 10 },
      { key: "cuti", width: 10 },
      { key: "sakitSrt", width: 11 },
      { key: "sakitNoSrt", width: 13 },
      { key: "jumlahHC", width: 11 },
    ];

    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15,
      },
    };
    sheet.printArea = "A1:Q" + (signatureRow + 8);

    // =========================
    // SHEET 2 — DATA HARIAN
    // =========================
    const dailySheet = workbook.addWorksheet("Data Harian", {
      views: [{ state: "frozen", ySplit: 6, xSplit: 2 }],
    });
    dailySheet.showGridLines = false;
    dailySheet.properties.defaultRowHeight = 21;

    const dailyLastCol = 2 + jumlahHari;
    const dailyLastColLetter = excelColumnName(dailyLastCol);

    dailySheet.mergeCells("A1:" + dailyLastColLetter + "1");
    dailySheet.getCell("A1").value =
      "DATA HARIAN KEHADIRAN — Periode " +
      formatTanggalIndonesia(tanggalAwal) +
      " s.d. " +
      formatTanggalIndonesia(tanggalAkhir);
    dailySheet.getCell("A1").font = {
      name: "Aptos Display",
      size: 14,
      bold: true,
      color: { argb: COLORS.white },
    };
    dailySheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    dailySheet.getCell("A1").alignment = {
      horizontal: "left",
      vertical: "middle",
    };
    dailySheet.getRow(1).height = 25;

    dailySheet.mergeCells("A2:" + dailyLastColLetter + "2");
    dailySheet.getCell("A2").value =
      "Kode: H = Hadir tepat waktu | T = Hadir terlambat | I = Izin (ada ket) | A = Alpha (tanpa ket) | S = Sakit ada surat | SX = Sakit tanpa surat | C = Cuti | L = Libur (Sabtu/Minggu/Libur) | kosong = tidak ada data.  Ubah kode di sini, sheet Rekap Absensi ikut berubah otomatis.";
    dailySheet.getCell("A2").font = {
      name: "Aptos",
      size: 9,
      color: { argb: COLORS.text },
    };
    dailySheet.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.lightBlue },
    };
    dailySheet.getCell("A2").alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    dailySheet.getRow(2).height = 32;

    const dailyHeaderRows = [4, 5, 6];
    dailySheet.getCell("A4").value = "NO";
    dailySheet.getCell("B4").value = "NAMA";
    dailySheet.mergeCells("A4:A6");
    dailySheet.mergeCells("B4:B6");

    tanggalList.forEach((tanggal, index) => {
      const col = index + 3;
      const bagian = bagianWaktuWIB(tanggal);
      const hari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][tanggal.getUTCDay()];
      dailySheet.getCell(4, col).value = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][bagian.bulan - 1];
      dailySheet.getCell(5, col).value = bagian.hari;
      dailySheet.getCell(6, col).value = hari;
    });

    for (const rowNum of dailyHeaderRows) {
      for (let col = 1; col <= dailyLastCol; col += 1) {
        const cell = dailySheet.getCell(rowNum, col);
        cell.font = {
          name: "Aptos",
          size: 9.5,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.navy },
        };
        cell.border = border;
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      }
    }
    dailySheet.getRow(4).height = 22;
    dailySheet.getRow(5).height = 22;
    dailySheet.getRow(6).height = 22;

    detailHarianPerKaryawan.forEach((item, index) => {
      const rowNum = dataStartRow + index;
      dailySheet.getCell(rowNum, 1).value = index + 1;
      dailySheet.getCell(rowNum, 2).value = item.nama;

      item.kodeHarian.forEach((kode, offset) => {
        dailySheet.getCell(rowNum, offset + 3).value = kode || null;
      });

      for (let col = 1; col <= dailyLastCol; col += 1) {
        const cell = dailySheet.getCell(rowNum, col);
        const isWeekendOrHoliday =
          col >= 3 &&
          (() => {
            const tanggal = tanggalList[col - 3];
            const key = tanggal.toISOString().slice(0, 10);
            return tanggal.getUTCDay() === 0 || tanggal.getUTCDay() === 6 || setHariLibur.has(key);
          })();

        cell.font = {
          name: "Aptos",
          size: col <= 2 ? 10 : 9.5,
          bold: col <= 2,
          color: { argb: COLORS.text },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor:
            isWeekendOrHoliday && !item.kodeHarian[col - 3]
              ? COLORS.lightGray
              : index % 2 === 0
                ? COLORS.white
                : COLORS.lightBlue,
        };
        cell.border = border;
        cell.alignment = {
          horizontal: col === 2 ? "left" : "center",
          vertical: "middle",
          wrapText: false,
        };
      }
    });

    dailySheet.columns = [
      { key: "no", width: 7 },
      { key: "nama", width: 30 },
      ...tanggalList.map(() => ({ width: 6 })),
    ];
    dailySheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.15,
        right: 0.15,
        top: 0.3,
        bottom: 0.3,
        header: 0.1,
        footer: 0.1,
      },
    };
    dailySheet.printArea =
      "A1:" +
      dailyLastColLetter +
      (dataStartRow + detailHarianPerKaryawan.length - 1);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"Rekap_Absensi_" + formatTanggalFile(tanggalAwal) + "-" + formatTanggalFile(tanggalAkhir) + ".xlsx\"");
    res.setHeader("Cache-Control", "no-store, private");
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Gagal export rekap absensi:", error);
    return res.status(500).json({ pesan: "Gagal membuat rekap absensi. Silakan coba lagi." });
  }
}
module.exports = {
  exportRekapAbsensi,
};
