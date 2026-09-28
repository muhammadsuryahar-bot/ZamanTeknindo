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
    const sheet = workbook.addWorksheet("Rekap Absensi", { views: [{ state: "frozen", ySplit: 6, xSplit: 2 }] });
    sheet.showGridLines = false;
    sheet.properties.defaultRowHeight = 20;

    const COLORS = { navy: "FF284B78", green: "FF2F7D32", blue: "FF2374B5", orange: "FFEE5B00", purple: "FF7020A8", red: "FFC62828", brown: "FF7A655E", brownDark: "FF71554B", teal: "FF00695C", lightBlue: "FFE9F1F9", grid: "FF8A8A8A", text: "FF1F2937", white: "FFFFFFFF", redText: "FFC00000" };
    const border = { top: { style: "thin", color: { argb: COLORS.grid } }, left: { style: "thin", color: { argb: COLORS.grid } }, bottom: { style: "thin", color: { argb: COLORS.grid } }, right: { style: "thin", color: { argb: COLORS.grid } } };

    sheet.mergeCells("A1:Q1");
    sheet.getCell("A1").value = "REKAP DATA KEHADIRAN KARYAWAN";
    sheet.getCell("A1").font = { name: "Aptos Display", size: 16, bold: true, color: { argb: COLORS.white } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    sheet.mergeCells("A2:Q2");
    sheet.getCell("A2").value = "PERIODE " + formatTanggalIndonesia(tanggalAwal) + " – " + formatTanggalIndonesia(tanggalAkhir) + "  •  " + jumlahHari + " Hari Kalender";
    sheet.getCell("A2").font = { name: "Aptos", size: 10.5, italic: true, color: { argb: COLORS.white } };
    sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 23;
    for (const rowNum of [1, 2]) for (let col = 1; col <= 17; col += 1) sheet.getCell(rowNum, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };

    ["A4:A6","B4:B6","C4:C6","D4:D6","E4:G4","H4:H6","I4:I6","J4:J6","K4:L4","M4:M6","N4:N6","O4:P4","Q4:Q6"].forEach((merge) => sheet.mergeCells(merge));
    const topHeaders = { A4: "NO", B4: "NAMA", C4: "TMK", D4: "", E4: "JUMLAH HAK CUTI", H4: "JLH\nKEHADIRAN", I4: "TERLAMBAT", J4: "JLH UANG MAKAN\nYANG DIBAYARKAN", K4: "TIDAK MASUK", M4: "LEMBUR", N4: "CUTI", O4: "SAKIT", Q4: "JLH HC" };
    Object.entries(topHeaders).forEach(([cell,value]) => { sheet.getCell(cell).value = value; });
    const subHeaders = { E5: "HC\n2024/2025", F5: "HC\n2025/2026", G5: "JLH HC SDH\nDIJALANI/DIPINJAM", K5: "ADA KET", L5: "TANPA KET", O5: "ADA SRT", P5: "TANPA SRT" };
    Object.entries(subHeaders).forEach(([cell,value]) => { sheet.getCell(cell).value = value; });
    const groupFills = { 1: COLORS.navy, 2: COLORS.navy, 3: COLORS.navy, 4: COLORS.white, 5: COLORS.green, 6: COLORS.green, 7: COLORS.green, 8: COLORS.blue, 9: COLORS.orange, 10: COLORS.purple, 11: COLORS.red, 12: COLORS.red, 13: COLORS.brown, 14: COLORS.brown, 15: COLORS.brownDark, 16: COLORS.brownDark, 17: COLORS.teal };
    for (let rowNum = 4; rowNum <= 6; rowNum += 1) for (let col = 1; col <= 17; col += 1) { const cell=sheet.getCell(rowNum,col); cell.border=border; cell.alignment={horizontal:"center",vertical:"middle",wrapText:true}; cell.font={name:"Aptos",size:9.5,bold:true,color:{argb:col===4?COLORS.text:COLORS.white}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:groupFills[col]||COLORS.navy}}; }
    sheet.getRow(4).height = 30; sheet.getRow(5).height = 35; sheet.getRow(6).height = 14;

    const dataStartRow = 7;
    let rowNumber = dataStartRow;
    ringkasanPerKaryawan.forEach((item, index) => {
      const row = sheet.getRow(rowNumber);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = item.nama;
      row.getCell(3).value = item.tmk;
      row.getCell(4).value = "";
      row.getCell(5).value = item.hc202425;
      row.getCell(6).value = item.hc202526;
      row.getCell(7).value = item.hcTerpakai;
      row.getCell(8).value = item.jumlahKehadiran;
      row.getCell(9).value = item.jumlahTelat;
      row.getCell(10).value = {
        formula: "MAX(0,H" + rowNumber + "-I" + rowNumber + ")",
        result: Math.max(0, Number(item.jumlahKehadiran || 0) - Number(item.jumlahTelat || 0)),
      };
      row.getCell(11).value = item.jumlahAdaKeterangan;
      row.getCell(12).value = {
        formula: "MAX(0,$N$" + (ringkasanPerKaryawan.length + dataStartRow + 2) + "-H" + rowNumber + "-K" + rowNumber + "-N" + rowNumber + "-O" + rowNumber + "-P" + rowNumber + ")",
        result: Number(item.jumlahTanpaKeterangan || 0),
      };
      row.getCell(13).value = item.lembur;
      row.getCell(14).value = item.cuti;
      row.getCell(15).value = item.sakitAdaSurat;
      row.getCell(16).value = item.sakitTanpaSurat;
      row.getCell(17).value = item.jumlahHC;
      const fill = index % 2 === 0 ? COLORS.white : COLORS.lightBlue; row.height = 23;
      for (let col = 1; col <= 17; col += 1) { const cell=row.getCell(col); cell.font={name:"Aptos",size:10,bold:[1,2,8,9,10,11,12,13,14,15,16].includes(col),color:{argb:col===17?COLORS.redText:COLORS.text}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}}; cell.border=border; cell.alignment={horizontal:col===2?"left":"center",vertical:"middle",wrapText:[2,3,5,6,7].includes(col)}; }
      rowNumber += 1;
    });

    const lastDataRow = rowNumber - 1;
    const footerStart = lastDataRow + 2;
    sheet.mergeCells("E" + footerStart + ":M" + footerStart); sheet.getCell("E" + footerStart).value = "Jumlah Hari Kalender dalam Periode " + formatTanggalIndonesia(tanggalAwal) + " - " + formatTanggalIndonesia(tanggalAkhir); sheet.getCell("N" + footerStart).value = jumlahHari + " Hari";
    sheet.mergeCells("E" + (footerStart+1) + ":M" + (footerStart+1)); sheet.getCell("E" + (footerStart+1)).value = "Jumlah Hari Kerja Efektif dalam Periode " + formatTanggalIndonesia(tanggalAwal) + " - " + formatTanggalIndonesia(tanggalAkhir); sheet.getCell("N" + (footerStart+1)).value = jumlahHariKerja;
    sheet.mergeCells("E" + (footerStart+2) + ":M" + (footerStart+2)); sheet.getCell("E" + (footerStart+2)).value = "Jumlah Hari Minggu, Libur dan Cuti Bersama Periode " + formatTanggalIndonesia(tanggalAwal) + " - " + formatTanggalIndonesia(tanggalAkhir); sheet.getCell("N" + (footerStart+2)).value = jumlahHariLibur + " Hari";
    for (let r = footerStart; r <= footerStart+2; r += 1) { const e=sheet.getCell("E"+r); e.font={name:"Aptos",size:10,bold:true,color:{argb:COLORS.navy}}; e.fill={type:"pattern",pattern:"solid",fgColor:{argb:COLORS.lightBlue}}; e.alignment={horizontal:"left",vertical:"middle",wrapText:true}; e.border=border; const n=sheet.getCell("N"+r); n.font={name:"Aptos",size:11,bold:true,color:{argb:COLORS.redText}}; n.alignment={horizontal:"center",vertical:"middle"}; n.border=border; sheet.getRow(r).height=24; }
    sheet.mergeCells("E" + (footerStart+3) + ":Q" + (footerStart+3)); sheet.getCell("E" + (footerStart+3)).value = "Sumber: data absensi sistem + pengajuan disetujui. JLH uang makan = JLH kehadiran - terlambat. Tidak masuk TANPA KET = hari kerja efektif - kehadiran - ada ket - cuti - sakit. LEMBUR disediakan sesuai format rekap."; sheet.getCell("E" + (footerStart+3)).font={name:"Aptos",size:9,italic:true,color:{argb:COLORS.text}}; sheet.getCell("E" + (footerStart+3)).alignment={horizontal:"left",vertical:"middle",wrapText:true}; sheet.getRow(footerStart+3).height=38;

    const signatureRow = footerStart + 6;
    sheet.mergeCells("A" + signatureRow + ":D" + signatureRow); sheet.getCell("A"+signatureRow).value="Dibuat Oleh,"; sheet.getCell("A"+signatureRow).font={name:"Aptos",size:10,bold:true,color:{argb:COLORS.text}}; sheet.getCell("A"+signatureRow).alignment={horizontal:"center",vertical:"middle"};
    sheet.mergeCells("A" + (signatureRow+1) + ":D" + (signatureRow+1)); sheet.getCell("A"+(signatureRow+1)).value="Zaman Teknindo"; sheet.getCell("A"+(signatureRow+1)).font={name:"Aptos",size:10,italic:true,color:{argb:COLORS.text}}; sheet.getCell("A"+(signatureRow+1)).alignment={horizontal:"center",vertical:"middle"};
    sheet.mergeCells("N" + signatureRow + ":Q" + signatureRow); sheet.getCell("N"+signatureRow).value="Diketahui Oleh,"; sheet.getCell("N"+signatureRow).font={name:"Aptos",size:10,bold:true,color:{argb:COLORS.text}}; sheet.getCell("N"+signatureRow).alignment={horizontal:"center",vertical:"middle"};

    sheet.columns = [
      { key: "no", width: 6 }, { key: "nama", width: 27 }, { key: "tmk", width: 15 }, { key: "spacer", width: 2.5 },
      { key: "hc2425", width: 16 }, { key: "hc2526", width: 16 }, { key: "hcUsed", width: 18 }, { key: "hadir", width: 13 },
      { key: "late", width: 12 }, { key: "meal", width: 18 }, { key: "adaKet", width: 13 }, { key: "tanpaKet", width: 13 },
      { key: "lembur", width: 10 }, { key: "cuti", width: 10 }, { key: "sakitSrt", width: 13 }, { key: "sakitNoSrt", width: 14 }, { key: "hcTotal", width: 10 },
    ];
    sheet.autoFilter = { from: "A6", to: "Q" + lastDataRow };
    sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 } };
    sheet.printArea = "A1:Q" + (signatureRow + 1);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"Rekap_Absensi_" + tanggalMulai + "_sampai_" + tanggalSelesai + ".xlsx\"");
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
