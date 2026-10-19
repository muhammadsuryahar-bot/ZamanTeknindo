const assert = require("assert");
const { PassThrough } = require("stream");
const Module = require("module");

const prismaMock = {
  pengguna: {
    findMany: async () => [
      { id: 1, nama: "Karyawan Satu", jabatan: "Staff", divisi: "Umum", kantor: { namaKantor: "Pekanbaru" } },
      { id: 2, nama: "Karyawan Dua", jabatan: "Staff", divisi: "Finance", kantor: { namaKantor: "Pekanbaru" } },
    ],
  },
  absensi: {
    findMany: async () => [
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-26T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-26T01:05:00.000Z"),
        jamPulang: new Date("2026-08-26T10:00:00.000Z"),
        statusOtomatis: "tepat_waktu",
        statusFinal: "tepat_waktu",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-27T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-27T01:15:00.000Z"),
        jamPulang: new Date("2026-08-27T10:00:00.000Z"),
        statusOtomatis: "telat",
        statusFinal: "telat",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-28T00:00:00.000Z"),
        jamMasuk: null,
        jamPulang: null,
        statusOtomatis: "alpha",
        statusFinal: "alpha",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 2,
        tanggal: new Date("2026-08-26T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-26T01:08:00.000Z"),
        jamPulang: new Date("2026-08-26T10:00:00.000Z"),
        statusOtomatis: "tepat_waktu",
        statusFinal: "tepat_waktu",
        keterangan: null,
        catatanAdmin: null,
      },
    ],
  },
  pengajuanIzin: {
    findMany: async () => [
      {
        id: 10,
        penggunaId: 1,
        tanggal: new Date("2026-09-01T00:00:00.000Z"),
        jenis: "cuti",
        keterangan: "Cuti tahunan",
        fotoSurat: null,
      },
      {
        id: 11,
        penggunaId: 1,
        tanggal: new Date("2026-09-02T00:00:00.000Z"),
        jenis: "sakit",
        keterangan: "Sakit",
        fotoSurat: "surat-sakit.jpg",
      },
      {
        id: 12,
        penggunaId: 1,
        tanggal: new Date("2026-09-03T00:00:00.000Z"),
        jenis: "sakit",
        keterangan: "Sakit",
        fotoSurat: null,
      },
      {
        id: 13,
        penggunaId: 2,
        tanggal: new Date("2026-09-01T00:00:00.000Z"),
        jenis: "izin",
        keterangan: "Keperluan keluarga",
        fotoSurat: null,
      },
      {
        id: 14,
        penggunaId: 2,
        tanggal: new Date("2026-09-04T00:00:00.000Z"),
        jenis: "izin",
        keterangan: "",
        fotoSurat: null,
      },
    ],
  },
  pengaturanPotongan: {
    findUnique: async () => ({ jamMasukStandar: "08:10:00" }),
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const parentFile = String(parent?.filename || "").replace(/\\/g, "/");
  if (
    parentFile.endsWith("backend/src/controllers/exportRekapAbsensiController.js") &&
    request === "../utils/prismaClient"
  ) {
    return prismaMock;
  }
  if (
    parentFile.endsWith("backend/src/controllers/exportRekapAbsensiController.js") &&
    request === "../utils/hariLibur"
  ) {
    return {
      ambilSetHariLibur: async () => new Set(),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const ExcelJS = require("exceljs");
const { exportRekapAbsensi } = require("../backend/src/controllers/exportRekapAbsensiController");

async function main() {
  const req = {
    query: {
      tanggalMulai: "2026-08-26",
      tanggalSelesai: "2026-09-25",
    },
    get: () => undefined,
  };

  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const headers = {};
  output.setHeader = (key, value) => {
    headers[String(key).toLowerCase()] = value;
  };
  output.getHeader = (key) => headers[String(key).toLowerCase()];

  const selesaiMenulis = new Promise((resolve, reject) => {
    if (output.writableFinished || output.readableEnded) return resolve();
    output.once("finish", resolve);
    output.once("error", reject);
  });

  await exportRekapAbsensi(req, output);
  await selesaiMenulis;
  assert.ok(chunks.length > 0, "Controller harus menghasilkan file XLSX");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks));

  assert.deepStrictEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Rekap Absensi", "Data Harian"],
    "Workbook wajib memiliki tepat 2 sheet sesuai HRD",
  );

  const rekap = workbook.getWorksheet("Rekap Absensi");
  const harian = workbook.getWorksheet("Data Harian");

  assert.ok(rekap, "Sheet Rekap Absensi harus ada");
  assert.ok(harian, "Sheet Data Harian harus ada");
  assert.strictEqual(rekap.columnCount, 17, "Rekap Absensi harus 17 kolom A:Q");
  assert.strictEqual(harian.columnCount, 33, "Data Harian periode 31 hari harus A:AG");

  // Dimensi merujuk langsung ke ukuran kolom/baris pada template HRD.
  assert.ok(Math.abs(rekap.getColumn(1).width - 5.54296875) < 0.01, "Lebar kolom NO mengikuti template");
  assert.ok(Math.abs(rekap.getColumn(2).width - 22) < 0.01, "Lebar kolom Nama mengikuti template");
  assert.ok(Math.abs(rekap.getColumn(3).width - 9.54296875) < 0.01, "Lebar kolom TMK kiri mengikuti template");
  assert.ok(Math.abs(rekap.getColumn(4).width - 9.54296875) < 0.01, "Lebar kolom TMK kanan mengikuti template");
  assert.ok(Math.abs(rekap.getColumn(8).width - 10) < 0.01, "Lebar kolom Kehadiran mengikuti template");
  assert.strictEqual(rekap.getRow(1).height, 30);
  assert.strictEqual(rekap.getRow(2).height, 19.5);
  assert.strictEqual(rekap.getRow(3).height, 6);
  assert.strictEqual(rekap.getRow(4).height, 15.75);
  assert.strictEqual(rekap.getRow(5).height, 15.75);
  assert.strictEqual(rekap.getRow(6).height, 27.75);
  assert.strictEqual(rekap.getRow(7).height, 16.5);
  assert.strictEqual(harian.properties.defaultRowHeight, 15);
  assert.strictEqual(harian.getRow(1).height, 17.25);
  assert.strictEqual(harian.getRow(2).height, 15);
  assert.strictEqual(harian.getRow(4).height, 15);

  assert.strictEqual(
    headers["content-disposition"],
    'attachment; filename="Rekap_Absensi_26Agu-25Sep2026.xlsx"',
    "Nama file mengikuti pola tanggal pada acuan HRD",
  );
  assert.match(
    String(rekap.getCell("A2").value),
    /PERIODE BULAN SEPTEMBER 2026.*26 AGUSTUS 2026.*25 SEPTEMBER 2026.*31 Hari Kalender/,
    "Judul periode menampilkan tanggal Indonesia dengan bulan huruf besar",
  );
  assert.strictEqual(
    harian.getCell("A1").value,
    "DATA HARIAN KEHADIRAN — Periode 26 Agustus s.d. 25 September 2026",
  );
  assert.strictEqual(rekap.getCell("A4").value, "NO");
  assert.strictEqual(rekap.getCell("B4").value, "NAMA");
  assert.strictEqual(rekap.getCell("C4").value, "TMK");
  assert.strictEqual(rekap.getCell("E4").value, "JUMLAH HAK CUTI");
  assert.strictEqual(rekap.getCell("E5").value, "HC\n2024/2025");
  assert.strictEqual(rekap.getCell("F5").value, "HC\n2025/2026");
  assert.strictEqual(rekap.getCell("G5").value, "JLH HC SDH\nDIJALANI/DIPINJAM");
  assert.strictEqual(rekap.getCell("H4").value, "JLH KEHADIRAN");
  assert.strictEqual(rekap.getCell("J4").value, "JLH UANG MAKAN\nYANG DIBAYARKAN");
  assert.strictEqual(rekap.getCell("Q4").value, "JLH HC");

  assert.strictEqual(harian.getCell("A4").value, "NO");
  assert.strictEqual(harian.getCell("B4").value, "NAMA");
  assert.strictEqual(harian.getCell("C4").value, "Agu");
  assert.strictEqual(harian.getCell("C5").value, 26);
  assert.strictEqual(harian.getCell("C6").value, "Rab");

  // Data Harian baris 7 dan baris 8 harus terpisah per karyawan.
  assert.strictEqual(harian.getCell("C7").value, "H");
  assert.strictEqual(harian.getCell("D7").value, "T");
  assert.strictEqual(harian.getCell("E7").value, "A");
  assert.strictEqual(harian.getCell("I7").value, "C");
  assert.strictEqual(harian.getCell("J7").value, "S");
  assert.strictEqual(harian.getCell("K7").value, "SX");
  assert.strictEqual(harian.getCell("C8").value, "H");

  // Rekap harus mengambil sumber dari baris Data Harian karyawan yang sama.
  assert.match(String(rekap.getCell("H7").value.formula), /'Data Harian'!\$C7:\$AG7/);
  assert.match(String(rekap.getCell("H8").value.formula), /'Data Harian'!\$C8:\$AG8/);
  assert.strictEqual(rekap.getCell("I7").value.result, 1);
  assert.strictEqual(rekap.getCell("N7").value.result, 1);
  assert.strictEqual(rekap.getCell("O7").value.result, 1);
  assert.strictEqual(rekap.getCell("P7").value.result, 1);
  assert.strictEqual(
    harian.getCell(8, 9).value,
    "I",
    "Izin dengan keterangan harus dihitung",
  );
  assert.strictEqual(
    harian.getCell(8, 12).value,
    null,
    "Izin tanpa keterangan tidak boleh dicatat sebagai I",
  );
  assert.strictEqual(rekap.getCell("D7").value, null);
  assert.strictEqual(rekap.getCell("E7").value, null);
  assert.strictEqual(rekap.getCell("F7").value, null);
  assert.strictEqual(rekap.getCell("G7").value, null);
  assert.strictEqual(rekap.getCell("M7").value, null);
  assert.match(String(rekap.getCell("Q7").value.formula), /SUM\(H7,K7:L7,N7:P7\)/);

  // 19 September (Sabtu) tetap ditandai L dan seluruh kolom akhir pekan berwarna abu-abu.
  const sep19Index = 24; // 26 Aug + 24 hari = 19 Sep
  assert.strictEqual(harian.getCell(7, 3 + sep19Index).value, "L");
  assert.strictEqual(
    harian.getCell(7, 3 + sep19Index).fill.fgColor.argb,
    "FFE6E9ED",
    "Seluruh kolom akhir pekan menggunakan latar abu-abu",
  );

  // Sesudah data karyawan hanya ada satu baris kosong—tanpa baris TOTAL.
  assert.strictEqual(rekap.getCell("A9").value, null);
  assert.strictEqual(rekap.getCell("A10").value, "Dibuat Oleh,");
  assert.strictEqual(rekap.getCell("P10").value, "Diketahui Oleh,");
  assert.strictEqual(rekap.getCell("E10").value, "Jumlah Hari Kalender dalam Bulan September 2026 (26 Agustus 2026 - 25 September 2026)");
  assert.strictEqual(rekap.getCell("N10").value, "31 Hari");
  assert.strictEqual(rekap.getCell("N11").value, "23 HKE");
  assert.strictEqual(rekap.getCell("N12").value, "08 Hari");
  assert.strictEqual(rekap.getCell("E13").value, "(Tanggal 29, 30 Agustus, 5, 6, 12, 13, 19, 20 September 2026)");
  assert.strictEqual(rekap.getCell("A17").value, "Azwar Effendi");
  assert.strictEqual(rekap.getCell("P17").value, "R. Nuning Rosita R");
  assert.strictEqual(rekap.getCell("A18").value, "SPV. Umum & Personalia");
  assert.strictEqual(rekap.getCell("P18").value, "Manager Financial");

  console.log("Export rekap HRD template integration test: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
