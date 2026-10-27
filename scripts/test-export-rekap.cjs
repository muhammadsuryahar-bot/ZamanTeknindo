const assert = require("assert");
const { PassThrough } = require("stream");
const Module = require("module");

const prismaMock = {
  pengguna: {
    findMany: async () => [
      { id: 1, nama: "Dimas Buluh Tenggono", jabatan: "Staff", divisi: "Umum", kantor: { namaKantor: "Pekanbaru" } },
      { id: 2, nama: "Azwar Effendi", jabatan: "Staff", divisi: "Finance", kantor: { namaKantor: "Pekanbaru" } },
      { id: 3, nama: "User Tester", jabatan: "Staff", divisi: "Testing", kantor: { namaKantor: "Pekanbaru" } },
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
const { exportRekapAbsensi, parseCheckLogWorkbook } = require("../backend/src/controllers/exportRekapAbsensiController");

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
    "Ekspor biasa harus tetap hanya berisi dua sheet HRD",
  );

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
  assert.strictEqual(harian.columnCount, 64, "Data Harian periode 31 hari harus memuat 2 kolom jam per tanggal (A:BL)");

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
  assert.strictEqual(rekap.getCell("A1").font.name, "Arial");
  assert.strictEqual(rekap.getCell("A1").font.size, 16);
  assert.strictEqual(rekap.getCell("A1").fill.fgColor.argb, "FF1F3864");
  assert.strictEqual(rekap.getCell("A2").font.size, 11);
  assert.strictEqual(rekap.getCell("A2").font.italic, true);
  assert.strictEqual(rekap.getCell("A4").font.name, "Arial");
  assert.strictEqual(rekap.getCell("A4").font.size, 10);
  assert.strictEqual(rekap.getCell("A7").fill.fgColor.argb, "FFF2F5FA");
  assert.strictEqual(rekap.getCell("A8").fill.fgColor.argb, "FFFFFFFF");
  assert.strictEqual(rekap.getCell("B7").font.bold, true);
  assert.strictEqual(rekap.getCell("E7").font.italic, true);
  assert.strictEqual(rekap.getCell("E7").font.color.argb, "FF808080");
  assert.strictEqual(rekap.getCell("G7").font.color.argb, "FFC00000");
  assert.strictEqual(rekap.getCell("Q7").font.color.argb, "FFC00000");
  assert.strictEqual(rekap.getCell("E30").fill.fgColor.argb, "FFEAF1FB");
  assert.strictEqual(rekap.getCell("E30").font.color.argb, "FF1F3864");
  assert.strictEqual(harian.properties.defaultRowHeight, 15);
  assert.strictEqual(harian.getRow(1).height, 17.25);
  assert.strictEqual(harian.getRow(2).height, 15);
  assert.strictEqual(harian.getRow(4).height, 18);
  assert.strictEqual(harian.getRow(5).height, 18);

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
  assert.strictEqual(harian.getCell("C4").value.toISOString().slice(0, 10), "2026-08-26");
  assert.strictEqual(harian.getCell("C4").numFmt, "m/d/yy");
  assert.strictEqual(harian.getCell("C5").value, "Clock In");
  assert.strictEqual(harian.getCell("D5").value, "Clock Out");
  assert.strictEqual(harian.getCell("A6").value, 1);
  assert.strictEqual(harian.getCell("B6").value, "Dimas Buluh T");
  const toMinutes = (cell) => {
    const value = cell.value;
    if (value instanceof Date) return value.getUTCHours() * 60 + value.getUTCMinutes();
    return Number.isFinite(Number(value)) && value !== null ? Math.round(Number(value) * 1440) : null;
  };
  assert.strictEqual(toMinutes(harian.getCell("C6")), 485, "Clock In 26 Agustus cocok dengan data sistem 08:05 WIB");
  assert.strictEqual(toMinutes(harian.getCell("D6")), 1020, "Clock Out 26 Agustus cocok dengan data sistem 17:00 WIB");
  assert.strictEqual(toMinutes(harian.getCell("E6")), 495, "Clock In 27 Agustus cocok dengan data sistem 08:15 WIB");
  assert.strictEqual(toMinutes(harian.getCell("F6")), 1020, "Clock Out 27 Agustus cocok dengan data sistem 17:00 WIB");
  const expectedRoster = [
    [1, "Dimas Buluh T"], [2, "Azwar Effendi"], [3, "Bidan Tamba"],
    [4, "Indah Puji Lestari"], [5, "R.Tjuntjun Candra"], [7, "Cindyka Fransiska"],
    [8, "Budi Winarso"], [9, "Novita Ramahyani"], [10, "Ratna Juwita"],
    [11, "Sugiono"], [12, "Fittry S"], [14, "Setiyo Widodo"],
    [16, "Arie Alfriadi S"], [17, "Jihan Adiba"], [19, "Ashabussalam"],
    [20, "Iqbal Lika Marja"], [21, "Edi Ponimin"], [22, "Andi Daulay"],
    [23, "M Rafael Harvio P"], [24, "Syaza Rafsanjani"], [25, "M Surya Harja"],
    [26, "Nur M. Maulanal Hakim"],
  ];
  assert.deepStrictEqual(
    expectedRoster.map(([nomor, nama], index) => [
      rekap.getCell(7 + index, 1).value,
      rekap.getCell(7 + index, 2).value,
    ]),
    expectedRoster,
    "Seluruh roster dan nomor HR harus sesuai file acuan, termasuk nomor yang terlewat",
  );
  assert.strictEqual(rekap.getCell("A8").value, 2);
  assert.strictEqual(rekap.getCell("B8").value, "Azwar Effendi");
  assert.strictEqual(rekap.getCell("A12").value, 7, "Nomor karyawan mengikuti nomor pada roster HRD, termasuk jeda");
  assert.strictEqual(rekap.getCell("B14").value, "Novita Ramahyani");
  assert.strictEqual(rekap.getCell("H14").value, null, "Nama HR tanpa akun tidak boleh ditampilkan sebagai nol");
  assert.strictEqual(harian.getCell("C13").value, null, "Nama HR tanpa akun tidak boleh memiliki jam buatan");
  assert.strictEqual(rekap.getCell("A25").value, 23);
  assert.strictEqual(rekap.getCell("B25").value, "M Rafael Harvio P");
  assert.strictEqual(rekap.getCell("H25").value, null);
  assert.strictEqual(harian.getCell("C24").value, null);
  assert.strictEqual(rekap.getCell("B29").value, null, "Akun di luar roster HR tidak boleh ikut ekspor");
  assert.strictEqual(harian.getCell("C6").font.name, "Arial");
  assert.strictEqual(harian.getCell("C6").font.size, 9);

  // Ringkasan berasal dari status absensi/pengajuan pada database mock, bukan jam harian.
  assert.strictEqual(rekap.getCell("H7").value, 2, "Dimas punya dua hari hadir");
  assert.strictEqual(rekap.getCell("I7").value, 1, "Dimas punya satu hari telat");
  assert.strictEqual(rekap.getCell("J7").value, 1, "Uang makan berkurang satu untuk hari telat");
  assert.strictEqual(rekap.getCell("K7").value, 0);
  assert.strictEqual(rekap.getCell("L7").value, 1, "Alpha diambil dari status sistem");
  assert.strictEqual(rekap.getCell("N7").value, 1);
  assert.strictEqual(rekap.getCell("O7").value, 1);
  assert.strictEqual(rekap.getCell("P7").value, 1);
  assert.strictEqual(rekap.getCell("Q7").value, 6);
  assert.strictEqual(rekap.getCell("H8").value, 1, "Azwar punya satu hari hadir");
  assert.strictEqual(rekap.getCell("K8").value, 1, "Izin disetujui dengan keterangan masuk rekap");
  assert.strictEqual(harian.getCell(6, 15).value, null, "Cuti tidak boleh menghasilkan jam buatan");
  assert.strictEqual(harian.getCell(7, 15).value, null, "Izin tidak boleh menghasilkan jam buatan");
  assert.strictEqual(harian.getCell(7, 21).value, null, "Tanggal tanpa jam tetap kosong");
  assert.strictEqual(toMinutes(harian.getCell("C7")), 488, "Waktu Azwar harus cocok dengan data sistem 08:08 WIB");
  assert.strictEqual(toMinutes(harian.getCell("D7")), 1020, "Jam pulang Azwar harus cocok dengan data sistem 17:00 WIB");
  assert.strictEqual(rekap.getCell("C7").value.toISOString().slice(0, 10), "2012-07-01");
  assert.strictEqual(rekap.getCell("D7").value.toISOString().slice(0, 10), "2012-07-01", "TMK berada di sel gabungan C:D");
  assert.strictEqual(rekap.getCell("E7").value, "Sdh hbs dijalani");
  assert.strictEqual(rekap.getCell("F7").value, "Sdh hbs dijalani");
  assert.strictEqual(rekap.getCell("G7").value, null, "Kolom JLH HC SDH DIJALANI/DIPINJAM harus tetap kosong");
  assert.strictEqual(rekap.getCell("M7").value, null);
  assert.strictEqual(rekap.getCell("Q7").value, 6, "Jumlah HC dihitung dari status absensi yang sama");

  // 19 September (Sabtu): pasangan jam Clock In/Clock Out tetap abu-abu.
  const sep19Index = 24; // 26 Aug + 24 hari = 19 Sep
  const sep19Col = 3 + 2 * sep19Index;
  assert.strictEqual(harian.getCell(6, sep19Col).value, null);
  assert.strictEqual(harian.getCell(6, sep19Col).fill.fgColor.argb, "FFD9D9D9");
  assert.strictEqual(harian.getCell(6, sep19Col + 1).fill.fgColor.argb, "FFD9D9D9");

  // Struktur akhir harus mempertahankan 22 nomor HR, satu baris kosong, ringkasan, dan tanda tangan.
  assert.strictEqual(rekap.getCell("A29").value, null);
  assert.strictEqual(rekap.getCell("A30").value, "Dibuat Oleh,");
  assert.strictEqual(rekap.getCell("P30").value, "Diketahui Oleh,");
  assert.strictEqual(rekap.getCell("E30").value, "Jumlah Hari Kalender dalam Bulan September 2026 (26 Agustus 2026 - 25 September 2026)");
  assert.strictEqual(rekap.getCell("N30").value, "31 Hari");
  assert.strictEqual(rekap.getCell("N31").value, "23 HKE");
  assert.strictEqual(rekap.getCell("N32").value, "08 Hari");
  assert.strictEqual(rekap.getCell("E33").value, "(Tanggal 29, 30 Agustus, 5, 6, 12, 13, 19, 20 September 2026)");
  assert.strictEqual(rekap.getCell("A37").value, "Azwar Effendi");
  assert.strictEqual(rekap.getCell("P37").value, "R. Nuning Rosita R");
  assert.strictEqual(rekap.getCell("A38").value, "SPV. Umum & Personalia");
  assert.strictEqual(rekap.getCell("P38").value, "Manager Financial");

  console.log("Export rekap HRD template integration test: PASS");

  // Revisi: unggahan Check Log menambah sheet perbandingan, tanpa mengganti dua sheet HRD.
  const inputCheckLog = new ExcelJS.Workbook();
  const checkSheet = inputCheckLog.addWorksheet("Check Log");
  checkSheet.addRow(["Nama Karyawan", "Tanggal", "Masuk", "Pulang"]);
  checkSheet.addRow(["Dimas Buluh Tenggono", new Date("2026-08-26T00:00:00.000Z"), 481 / 1440, 1023 / 1440]);
  const inputBuffer = await inputCheckLog.xlsx.writeBuffer();

  const revisedReq = { ...req, file: { originalname: "checklog.xlsx", buffer: Buffer.from(inputBuffer) }, revisiAbsensi: true };
  const revisedOutput = new PassThrough();
  const revisedChunks = [];
  revisedOutput.on("data", (chunk) => revisedChunks.push(Buffer.from(chunk)));
  const revisedHeaders = {};
  revisedOutput.setHeader = (key, value) => { revisedHeaders[String(key).toLowerCase()] = value; };
  revisedOutput.getHeader = (key) => revisedHeaders[String(key).toLowerCase()];
  const revisedFinished = new Promise((resolve, reject) => {
    if (revisedOutput.writableFinished || revisedOutput.readableEnded) return resolve();
    revisedOutput.once("finish", resolve);
    revisedOutput.once("error", reject);
  });

  await exportRekapAbsensi(revisedReq, revisedOutput);
  await revisedFinished;
  assert.ok(revisedChunks.length > 0, "Export revisi harus menghasilkan XLSX");
  assert.strictEqual(
    revisedHeaders["x-rekap-excel-mode"],
    "revisi-check-log",
    "Respons ekspor revisi harus secara eksplisit mengonfirmasi mode revisi",
  );
  assert.strictEqual(
    revisedHeaders["x-rekap-excel-sheets"],
    "Rekap Absensi|Data Harian|Perbandingan Jam",
    "Respons revisi wajib mengonfirmasi ketiga nama sheet",
  );
  const revisedWorkbook = new ExcelJS.Workbook();
  await revisedWorkbook.xlsx.load(Buffer.concat(revisedChunks));
  assert.deepStrictEqual(
    revisedWorkbook.worksheets.map((sheet) => sheet.name),
    ["Rekap Absensi", "Data Harian", "Perbandingan Jam"],
    "Export revisi menambah sheet pembandingan sambil menjaga dua sheet HRD",
  );
  const compare = revisedWorkbook.getWorksheet("Perbandingan Jam");
  assert.strictEqual(compare.getCell("A3").value, "NAMA KARYAWAN");
  assert.strictEqual(compare.getCell("C3").value, "HP");
  assert.strictEqual(compare.getCell("E3").value, "Check Log");
  assert.strictEqual(compare.getCell("H3").value, "Result (submit ke atasan)");
  assert.strictEqual(compare.getCell("A5").value, "Dimas Buluh T");
  assert.strictEqual(compare.getCell("B5").value, "26 Agustus 2026");
  const menitDariCellExcel = (cell) => {
    const value = compare.getCell(cell).value;
    if (value instanceof Date) return value.getUTCHours() * 60 + value.getUTCMinutes();
    return Number.isFinite(Number(value)) ? Math.round(Number(value) * 1440) : null;
  };
  assert.strictEqual(menitDariCellExcel("C5"), 485, "HP Masuk harus berisi 08:05 dari sistem");
  assert.strictEqual(menitDariCellExcel("D5"), 1020, "HP Pulang harus berisi 17:00 dari sistem");
  assert.strictEqual(menitDariCellExcel("E5"), 481, "Check Log Masuk harus berisi 08:01");
  assert.strictEqual(menitDariCellExcel("F5"), 1023, "Check Log Pulang harus berisi 17:03");
  assert.strictEqual(menitDariCellExcel("H5"), 481, "Result Masuk harus memilih jam paling awal");
  assert.strictEqual(menitDariCellExcel("I5"), 1023, "Result Pulang harus memilih jam paling akhir");
  assert.strictEqual(compare.getCell("H222").value, null, "Karyawan tanpa akun/data tidak boleh menghasilkan jam buatan");
  console.log("Export rekap revisi + pemilihan waktu Check Log integration test: PASS");

  // Check Log mentah dari mesin sering berbentuk satu baris per scan: Name, Time, State.
  const rawLogWorkbook = new ExcelJS.Workbook();
  const rawLogSheet = rawLogWorkbook.addWorksheet("Raw Check Log");
  rawLogSheet.addRow(["Name", "Time", "State"]);
  rawLogSheet.addRow(["Dimas Buluh Tenggono", new Date("2026-08-26T08:09:00.000Z"), 0]);
  rawLogSheet.addRow(["Dimas Buluh Tenggono", new Date("2026-08-26T08:01:00.000Z"), 0]);
  rawLogSheet.addRow(["Dimas Buluh Tenggono", new Date("2026-08-26T16:58:00.000Z"), 1]);
  rawLogSheet.addRow(["Dimas Buluh Tenggono", new Date("2026-08-26T17:03:00.000Z"), 1]);
  const rawLogBuffer = Buffer.from(await rawLogWorkbook.xlsx.writeBuffer());
  const parsedRawLog = await parseCheckLogWorkbook(rawLogBuffer);
  const rawLogResult = parsedRawLog.peta.get("dimasbuluht_2026-08-26");
  assert.ok(rawLogResult, "Format Check Log mentah harus dikenali");
  assert.strictEqual(rawLogResult.masuk, 481, "Jika ada beberapa scan masuk, ambil yang paling awal");
  assert.strictEqual(rawLogResult.pulang, 1023, "Jika ada beberapa scan pulang, ambil yang paling akhir");
  console.log("Parser Check Log mentah (Name/Time/State) + duplicate scans: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
