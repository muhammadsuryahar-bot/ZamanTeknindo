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
    const tanggalSelesai =
      normalisasiTanggal(req.query?.tanggalSelesai) || tanggalMulai;

    if (tanggalMulai > tanggalSelesai) {
      return res.status(400).json({
        pesan: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai.",
      });
    }

    if (tanggalSelesai > hariIni) {
      return res.status(400).json({
        pesan: "Rekap tidak boleh mencakup tanggal yang akan datang.",
      });
    }

    const tanggalAwal = tanggalUTC(tanggalMulai);
    const tanggalAkhir = tanggalUTC(tanggalSelesai);
    const jumlahHari =
      Math.floor((tanggalAkhir - tanggalAwal) / (24 * 60 * 60 * 1000)) + 1;

    if (jumlahHari > 31) {
      return res.status(400).json({
        pesan: "Rentang rekap maksimal 31 hari per file.",
      });
    }

    const rangeStart = new Date(`${tanggalMulai}T00:00:00+07:00`);
    const rangeEnd = new Date(`${tanggalSelesai}T23:59:59.999+07:00`);

    const [karyawan, absensi, pengajuanDisetujui, pengaturan, setHariLibur] =
      await Promise.all([
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
            kantor: {
              select: {
                namaKantor: true,
              },
            },
          },
          orderBy: { nama: "asc" },
        }),
        prisma.absensi.findMany({
          where: {
            tanggal: {
              gte: rangeStart,
              lte: rangeEnd,
            },
            pengguna: {
              peran: "karyawan",
              statusAkun: "aktif",
            },
          },
          select: {
            penggunaId: true,
            tanggal: true,
            jamMasuk: true,
            jamPulang: true,
            statusOtomatis: true,
            statusFinal: true,
            catatanAdmin: true,
          },
          orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }],
        }),
        prisma.pengajuanIzin.findMany({
          where: {
            tanggal: {
              gte: rangeStart,
              lte: rangeEnd,
            },
            status: "disetujui",
            pengguna: {
              peran: "karyawan",
              statusAkun: "aktif",
            },
          },
          select: {
            penggunaId: true,
            tanggal: true,
            jenis: true,
            keterangan: true,
          },
        }),
        prisma.pengaturanPotongan.findUnique({
          where: { id: 1 },
          select: { jamMasukStandar: true },
        }),
        ambilSetHariLibur(
          Number(tanggalMulai.slice(0, 4)),
        ),
      ]);

    const jamMasukStandar =
      pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    const petaAbsensi = new Map();
    for (const item of absensi) {
      const tanggalKey = item.tanggal.toISOString().slice(0, 10);
      petaAbsensi.set(`${item.penggunaId}_${tanggalKey}`, item);
    }

    const petaIzin = new Map();
    for (const item of pengajuanDisetujui) {
      const tanggalKey = item.tanggal.toISOString().slice(0, 10);
      petaIzin.set(`${item.penggunaId}_${tanggalKey}`, item);
    }

    const tanggalList = daftarTanggal(tanggalMulai, tanggalSelesai);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zaman Teknindo";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Rekap Absensi", {
      views: [{ state: "frozen", ySplit: 4, xSplit: 2 }],
    });
    sheet.showGridLines = false;
    sheet.properties.defaultRowHeight = 21;

    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "REKAP ABSENSI KARYAWAN";
    sheet.getCell("A1").font = {
      name: "Aptos Display",
      size: 16,
      bold: true,
      color: { argb: WARNA.navy },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "left",
      vertical: "middle",
    };
    sheet.getRow(1).height = 28;

    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value =
      `Periode: ${formatTanggalIndonesia(tanggalAwal)} s.d. ${formatTanggalIndonesia(tanggalAkhir)} • Tanpa data gaji`;
    sheet.getCell("A2").font = {
      name: "Aptos",
      size: 10,
      color: { argb: WARNA.teks },
    };

    sheet.mergeCells("A3:J3");
    sheet.getCell("A3").value =
      `Karyawan aktif: ${karyawan.length} • Jam masuk standar: ${jamMasukStandar}`;
    sheet.getCell("A3").font = {
      name: "Aptos",
      size: 10,
      color: { argb: WARNA.teks },
    };

    const headers = [
      "No",
      "Tanggal",
      "Nama",
      "Jabatan",
      "Divisi",
      "Kantor",
      "Jam Masuk",
      "Jam Pulang",
      "Status",
      "Keterangan",
    ];
    const headerRow = sheet.getRow(4);
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header;
    });
    gayaHeader(headerRow, headers.length);

    let nomor = 1;
    for (const tanggal of tanggalList) {
      const tanggalKey = tanggal.toISOString().slice(0, 10);
      const hariKerja =
        tanggal.getUTCDay() !== 0 &&
        tanggal.getUTCDay() !== 6 &&
        !setHariLibur.has(tanggalKey);

      for (const item of karyawan) {
        const absensiItem = petaAbsensi.get(`${item.id}_${tanggalKey}`);
        const izinItem = petaIzin.get(`${item.id}_${tanggalKey}`);

        // Hari libur/weekend tidak membuat baris Alpha kosong.
        // Tetapi jika ada absensi nyata pada hari tersebut, tetap ditampilkan.
        if (!hariKerja && !absensiItem && !izinItem) continue;

        const statusKunci = absensiItem
          ? statusDariAbsensi(absensiItem, jamMasukStandar)
          : izinItem
            ? izinItem.jenis
            : tanggalKey === hariIni
              ? "belum_absen"
              : "alpha";

        const status = STATUS_TAMPILAN[statusKunci] || "Alpha";
        const menitTerlambat = hitungKeterlambatan(
          absensiItem,
          jamMasukStandar,
        );

        let keterangan = "-";
        if (absensiItem?.catatanAdmin) {
          keterangan = absensiItem.catatanAdmin;
        } else if (izinItem?.keterangan) {
          keterangan = izinItem.keterangan;
        } else if (statusKunci === "alpha") {
          keterangan = "Tidak ada absensi";
        } else if (statusKunci === "belum_absen") {
          keterangan = "Belum melakukan absensi";
        } else if (statusKunci === "telat") {
          keterangan = `Terlambat ${formatKeterlambatan(menitTerlambat)}`;
        } else if (statusKunci === "tepat_waktu") {
          keterangan = "Masuk sesuai jadwal";
        }

        const row = sheet.addRow([
          nomor++,
          formatTanggalIndonesia(tanggal),
          item.nama || "-",
          item.jabatan || "-",
          item.divisi || "-",
          item.kantor?.namaKantor || "Belum ditentukan",
          formatJam(absensiItem?.jamMasuk),
          formatJam(absensiItem?.jamPulang),
          status,
          keterangan,
        ]);

        const fill = row.number % 2 === 0 ? WARNA.abu : WARNA.putih;
        row.height = 22;
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          gayaData(cell, {
            horizontal:
              columnNumber <= 2
                ? "center"
                : "left",
            wrapText: [3, 4, 5, 6, 10].includes(columnNumber),
            bold: columnNumber === 3,
          });
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fill },
          };

          if (columnNumber === 9) {
            isiWarnaStatus(cell, status);
          }
        });
      }
    }

    const lastRow = Math.max(4, sheet.rowCount);
    sheet.autoFilter = {
      from: "A4",
      to: `J${lastRow}`,
    };

    sheet.columns = [
      { width: 6 },
      { width: 14 },
      { width: 28 },
      { width: 22 },
      { width: 18 },
      { width: 24 },
      { width: 12 },
      { width: 12 },
      { width: 17 },
      { width: 42 },
    ];

    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalDpi: 300,
      verticalDpi: 300,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };
    sheet.printArea = `A1:J${lastRow}`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Rekap_Absensi_${tanggalMulai}_sampai_${tanggalSelesai}.xlsx"`,
    );
    res.setHeader("Cache-Control", "no-store, private");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Gagal export rekap absensi:", error);
    return res.status(500).json({
      pesan: "Gagal membuat rekap absensi. Silakan coba lagi.",
    });
  }
}

module.exports = {
  exportRekapAbsensi,
};
