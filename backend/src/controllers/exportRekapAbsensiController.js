const ExcelJS = require("exceljs");

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
    if (jumlahHari > 62) {
      return res.status(400).json({ pesan: "Rentang rekap maksimal 62 hari per file." });
    }

    const rangeStart = new Date(tanggalMulai + "T00:00:00+07:00");
    const rangeEnd = new Date(tanggalSelesai + "T23:59:59.999+07:00");

    const [karyawan, absensi, pengajuanDisetujui, pengaturan, setHariLibur] = await Promise.all([
      prisma.pengguna.findMany({
        where: {
          peran: "karyawan",
          OR: [
            { statusAkun: "aktif" },
            { absensi: { some: { tanggal: { gte: rangeStart, lte: rangeEnd } } } },
            { pengajuanIzin: { some: { tanggal: { gte: rangeStart, lte: rangeEnd }, status: "disetujui" } } },
          ],
        },
        select: { id: true, nama: true, jabatan: true, divisi: true, kantor: { select: { namaKantor: true } } },
        orderBy: { nama: "asc" },
      }),
      prisma.absensi.findMany({
        where: { tanggal: { gte: rangeStart, lte: rangeEnd }, pengguna: { peran: "karyawan", statusAkun: "aktif" } },
        select: { penggunaId: true, tanggal: true, jamMasuk: true, jamPulang: true, statusOtomatis: true, statusFinal: true, catatanAdmin: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }],
      }),
      prisma.pengajuanIzin.findMany({
        where: { tanggal: { gte: rangeStart, lte: rangeEnd }, status: "disetujui", pengguna: { peran: "karyawan", statusAkun: "aktif" } },
        select: { id: true, penggunaId: true, tanggal: true, jenis: true, keterangan: true, fotoSurat: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }, { id: "asc" }],
      }),
      prisma.pengaturanPotongan.findUnique({ where: { id: 1 }, select: { jamMasukStandar: true } }),
      Promise.all(
        [...new Set([Number(tanggalMulai.slice(0, 4)), Number(tanggalSelesai.slice(0, 4))])].map((tahun) => ambilSetHariLibur(tahun)),
      ).then((setList) => new Set(setList.flatMap((setTahun) => [...setTahun]))),
    ]);

    const jamMasukStandar = pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;
    const petaAbsensi = new Map();
    for (const item of absensi) {
      const tanggalKey = item.tanggal instanceof Date ? item.tanggal.toISOString().slice(0, 10) : String(item.tanggal).slice(0, 10);
      petaAbsensi.set(item.penggunaId + "_" + tanggalKey, item);
    }
    const petaIzin = new Map();
    for (const item of pengajuanDisetujui) {
      const tanggalKey = item.tanggal instanceof Date ? item.tanggal.toISOString().slice(0, 10) : String(item.tanggal).slice(0, 10);
      petaIzin.set(item.penggunaId + "_" + tanggalKey, item);
    }

    const tanggalList = daftarTanggal(tanggalMulai, tanggalSelesai);
    const hariKerjaList = tanggalList.filter((tanggal) => {
      const tanggalKey = tanggal.toISOString().slice(0, 10);
      const hari = tanggal.getUTCDay();
      return hari !== 0 && hari !== 6 && !setHariLibur.has(tanggalKey);
    });
    const jumlahHariKerja = hariKerjaList.length;
    const jumlahHariLibur = Math.max(jumlahHari - jumlahHariKerja, 0);

    const ringkasanPerKaryawan = karyawan.map((item) => {
      const prefix = item.id + "_";
      let jumlahKehadiran = 0;
      let jumlahTelat = 0;
      let jumlahAdaKeterangan = 0;
      let jumlahCuti = 0;
      let jumlahSakitAdaSurat = 0;
      let jumlahSakitTanpaSurat = 0;

      const tanggalKeterangan = new Set();
      const tanggalCuti = new Set();
      const tanggalSakit = new Set();

      for (const tanggal of hariKerjaList) {
        const tanggalKey = tanggal.toISOString().slice(0, 10);
        const absensiItem = petaAbsensi.get(prefix + tanggalKey);
        const izinItem = petaIzin.get(prefix + tanggalKey);
        const punyaCap = Boolean(absensiItem?.jamMasuk || absensiItem?.jamPulang);
        const status = absensiItem ? statusDariAbsensi(absensiItem, jamMasukStandar) : null;

        if (punyaCap) {
          jumlahKehadiran += 1;
          if (status === "telat") jumlahTelat += 1;
          continue;
        }
        if (status === "cuti" || izinItem?.jenis === "cuti") {
          if (!tanggalCuti.has(tanggalKey)) { jumlahCuti += 1; tanggalCuti.add(tanggalKey); }
          continue;
        }
        if (status === "sakit" || izinItem?.jenis === "sakit") {
          if (!tanggalSakit.has(tanggalKey)) {
            if (izinItem?.jenis === "sakit" && izinItem.fotoSurat) jumlahSakitAdaSurat += 1;
            else jumlahSakitTanpaSurat += 1;
            tanggalSakit.add(tanggalKey);
          }
          continue;
        }
        if (status === "izin" || status === "urgent" || izinItem?.jenis === "izin" || izinItem?.jenis === "urgent") {
          if (!tanggalKeterangan.has(tanggalKey)) { jumlahAdaKeterangan += 1; tanggalKeterangan.add(tanggalKey); }
        }
      }

      for (const [key, absensiItem] of petaAbsensi.entries()) {
        if (!key.startsWith(prefix)) continue;
        const tanggalKey = key.slice(prefix.length);
        const tanggalObj = tanggalUTC(tanggalMulai);
        const adaDiHariKerja = hariKerjaList.some((d) => d.toISOString().slice(0, 10) === tanggalKey);
        if (!adaDiHariKerja) continue;
        const punyaCap = Boolean(absensiItem?.jamMasuk || absensiItem?.jamPulang);
        if (punyaCap) continue;
        const status = statusDariAbsensi(absensiItem, jamMasukStandar);
        if ((status === "izin" || status === "urgent") && !tanggalKeterangan.has(tanggalKey)) { jumlahAdaKeterangan += 1; tanggalKeterangan.add(tanggalKey); }
        else if (status === "cuti" && !tanggalCuti.has(tanggalKey)) { jumlahCuti += 1; tanggalCuti.add(tanggalKey); }
        else if (status === "sakit" && !tanggalSakit.has(tanggalKey)) { jumlahSakitTanpaSurat += 1; tanggalSakit.add(tanggalKey); }
      }

      const jumlahSakit = jumlahSakitAdaSurat + jumlahSakitTanpaSurat;
      const jumlahTanpaKeterangan = Math.max(jumlahHariKerja - jumlahKehadiran - jumlahAdaKeterangan - jumlahCuti - jumlahSakit, 0);
      return {
        nama: item.nama || "-",
        tmk: "-",
        hc202425: "-",
        hc202526: "-",
        hcTerpakai: "-",
        jumlahKehadiran,
        jumlahTelat,
        jumlahUangMakan: Math.max(jumlahKehadiran - jumlahTelat, 0),
        jumlahAdaKeterangan,
        jumlahTanpaKeterangan,
        lembur: null,
        cuti: jumlahCuti,
        sakitAdaSurat: jumlahSakitAdaSurat,
        sakitTanpaSurat: jumlahSakitTanpaSurat,
        jumlahHC: "-",
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zaman Teknindo";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Rekap Absensi", {
      views: [{ state: "frozen", ySplit: 6, xSplit: 2 }],
    });
    sheet.showGridLines = false;
    sheet.properties.defaultRowHeight = 20;

    const COLORS = {
      navy: "FF284B78",
      blue: "FF2374B5",
      orange: "FFEE5B00",
      purple: "FF7020A8",
      red: "FFC62828",
      brown: "FF7A655E",
      brownDark: "FF71554B",
      lightBlue: "FFE9F1F9",
      grid: "FF8A8A8A",
      text: "FF1F2937",
      white: "FFFFFFFF",
    };

    const border = {
      top: { style: "thin", color: { argb: COLORS.grid } },
      left: { style: "thin", color: { argb: COLORS.grid } },
      bottom: { style: "thin", color: { argb: COLORS.grid } },
      right: { style: "thin", color: { argb: COLORS.grid } },
    };

    sheet.mergeCells("A1:K1");
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
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value =
      "PERIODE " +
      formatTanggalIndonesia(tanggalAwal) +
      " – " +
      formatTanggalIndonesia(tanggalAkhir) +
      "  •  " +
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
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 23;

    for (const rowNum of [1, 2]) {
      for (let col = 1; col <= 11; col += 1) {
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
      "E4:E6",
      "F4:G4",
      "H4:H6",
      "I4:I6",
      "J4:K4",
    ].forEach((merge) => sheet.mergeCells(merge));

    const topHeaders = {
      A4: "NO",
      B4: "NAMA",
      C4: "JLH KEHADIRAN",
      D4: "TERLAMBAT",
      E4: "JLH UANG MAKAN\nYANG DIBAYARKAN",
      F4: "TIDAK MASUK",
      H4: "LEMBUR",
      I4: "CUTI",
      J4: "SAKIT",
    };

    Object.entries(topHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const subHeaders = {
      F5: "ADA KET",
      G5: "TANPA KET",
      J5: "ADA SRT",
      K5: "TANPA SRT",
    };

    Object.entries(subHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const groupFills = {
      1: COLORS.navy,
      2: COLORS.navy,
      3: COLORS.blue,
      4: COLORS.orange,
      5: COLORS.purple,
      6: COLORS.red,
      7: COLORS.red,
      8: COLORS.brown,
      9: COLORS.brown,
      10: COLORS.brownDark,
      11: COLORS.brownDark,
    };

    for (let rowNum = 4; rowNum <= 6; rowNum += 1) {
      for (let col = 1; col <= 11; col += 1) {
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
    sheet.getRow(5).height = 34;
    sheet.getRow(6).height = 14;

    const dataStartRow = 7;
    let rowNumber = dataStartRow;

    ringkasanPerKaryawan.forEach((item, index) => {
      const row = sheet.getRow(rowNumber);

      row.getCell(1).value = index + 1;
      row.getCell(2).value = item.nama;
      row.getCell(3).value = Number(item.jumlahKehadiran || 0);
      row.getCell(4).value = Number(item.jumlahTelat || 0);

      row.getCell(5).value = {
        formula: "MAX(0,C" + rowNumber + "-D" + rowNumber + ")",
        result: Math.max(
          0,
          Number(item.jumlahKehadiran || 0) - Number(item.jumlahTelat || 0),
        ),
      };

      row.getCell(6).value = Number(item.jumlahAdaKeterangan || 0);
      row.getCell(7).value = Number(item.jumlahTanpaKeterangan || 0);

      // LEMBUR sengaja dibiarkan kosong sesuai format perusahaan.
      row.getCell(8).value = null;

      row.getCell(9).value = Number(item.cuti || 0);
      row.getCell(10).value = Number(item.sakitAdaSurat || 0);
      row.getCell(11).value = Number(item.sakitTanpaSurat || 0);

      const fill = index % 2 === 0 ? COLORS.white : COLORS.lightBlue;
      row.height = 23;

      for (let col = 1; col <= 11; col += 1) {
        const cell = row.getCell(col);
        cell.font = {
          name: "Aptos",
          size: 10,
          bold: col >= 3 && col !== 8,
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
    });

    const lastDataRow = rowNumber - 1;
    const totalRow = lastDataRow + 1;

    sheet.mergeCells("A" + totalRow + ":B" + totalRow);
    sheet.getCell("A" + totalRow).value = "TOTAL";
    sheet.getCell("C" + totalRow).value = {
      formula: "SUM(C" + dataStartRow + ":C" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.jumlahKehadiran || 0),
        0,
      ),
    };
    sheet.getCell("D" + totalRow).value = {
      formula: "SUM(D" + dataStartRow + ":D" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.jumlahTelat || 0),
        0,
      ),
    };
    sheet.getCell("E" + totalRow).value = {
      formula: "MAX(0,C" + totalRow + "-D" + totalRow + ")",
      result: Math.max(
        0,
        ringkasanPerKaryawan.reduce(
          (sum, item) => sum + Number(item.jumlahKehadiran || 0),
          0,
        ) -
          ringkasanPerKaryawan.reduce(
            (sum, item) => sum + Number(item.jumlahTelat || 0),
            0,
          ),
      ),
    };
    sheet.getCell("F" + totalRow).value = {
      formula: "SUM(F" + dataStartRow + ":F" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.jumlahAdaKeterangan || 0),
        0,
      ),
    };
    sheet.getCell("G" + totalRow).value = {
      formula: "SUM(G" + dataStartRow + ":G" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.jumlahTanpaKeterangan || 0),
        0,
      ),
    };
    sheet.getCell("H" + totalRow).value = null;
    sheet.getCell("I" + totalRow).value = {
      formula: "SUM(I" + dataStartRow + ":I" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.cuti || 0),
        0,
      ),
    };
    sheet.getCell("J" + totalRow).value = {
      formula: "SUM(J" + dataStartRow + ":J" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.sakitAdaSurat || 0),
        0,
      ),
    };
    sheet.getCell("K" + totalRow).value = {
      formula: "SUM(K" + dataStartRow + ":K" + lastDataRow + ")",
      result: ringkasanPerKaryawan.reduce(
        (sum, item) => sum + Number(item.sakitTanpaSurat || 0),
        0,
      ),
    };

    for (let col = 1; col <= 11; col += 1) {
      const cell = sheet.getCell(totalRow, col);
      cell.font = {
        name: "Aptos",
        size: 10,
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
    sheet.getRow(totalRow).height = 24;

    const footerStart = totalRow + 2;
    const footerLines = [
      "Jumlah Hari Kalender dalam Periode " +
        formatTanggalIndonesia(tanggalAwal) +
        " - " +
        formatTanggalIndonesia(tanggalAkhir) +
        " : " +
        jumlahHari +
        " Hari",
      "Jumlah Hari Kerja Efektif dalam Periode " +
        formatTanggalIndonesia(tanggalAwal) +
        " - " +
        formatTanggalIndonesia(tanggalAkhir) +
        " : " +
        jumlahHariKerja +
        " Hari",
      "Jumlah Hari Minggu, Sabtu, dan Hari Libur : " +
        jumlahHariLibur +
        " Hari",
      "Rumus: JLH UANG MAKAN = JLH KEHADIRAN - TERLAMBAT. LEMBUR sengaja dikosongkan. TANPA KET = hari kerja efektif yang bukan hadir, ada keterangan, cuti, atau sakit.",
      "Sumber rekap: data absensi sistem + pengajuan yang disetujui pada periode yang dipilih.",
    ];

    footerLines.forEach((text, index) => {
      const rowIndex = footerStart + index;
      sheet.mergeCells("A" + rowIndex + ":K" + rowIndex);
      const cell = sheet.getCell("A" + rowIndex);
      cell.value = text;
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
      sheet.getRow(rowIndex).height = index < 3 ? 23 : 34;
    });

    const signatureRow = footerStart + footerLines.length + 2;

    sheet.mergeCells("A" + signatureRow + ":C" + signatureRow);
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

    sheet.mergeCells("I" + signatureRow + ":K" + signatureRow);
    sheet.getCell("I" + signatureRow).value = "Diketahui Oleh,";
    sheet.getCell("I" + signatureRow).font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: COLORS.text },
    };
    sheet.getCell("I" + signatureRow).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A" + (signatureRow + 1) + ":C" + (signatureRow + 1));
    sheet.getCell("A" + (signatureRow + 1)).value = "Zaman Teknindo";
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

    sheet.columns = [
      { key: "no", width: 6 },
      { key: "nama", width: 28 },
      { key: "hadir", width: 14 },
      { key: "late", width: 12 },
      { key: "meal", width: 21 },
      { key: "adaKet", width: 13 },
      { key: "tanpaKet", width: 13 },
      { key: "lembur", width: 10 },
      { key: "cuti", width: 10 },
      { key: "sakitSrt", width: 13 },
      { key: "sakitNoSrt", width: 14 },
    ];

    sheet.autoFilter = {
      from: "A6",
      to: "K" + lastDataRow,
    };

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

    sheet.printArea = "A1:K" + (signatureRow + 1);

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
