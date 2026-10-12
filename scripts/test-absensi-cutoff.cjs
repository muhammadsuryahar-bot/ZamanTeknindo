const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  BATAS_ABSEN_MASUK_WIB,
  totalMenitWIB,
  sudahLewatBatasAbsenMasukWIB,
} = require("../backend/src/utils/waktuIndonesia");

const baca = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

function dateWIB(hour, minute) {
  return new Date(`2026-10-07T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`);
}

assert.strictEqual(BATAS_ABSEN_MASUK_WIB, 720);
assert.strictEqual(totalMenitWIB(dateWIB(11, 59)), 719);
assert.strictEqual(totalMenitWIB(dateWIB(12, 0)), 720);
assert.strictEqual(totalMenitWIB(dateWIB(12, 1)), 721);
assert.strictEqual(sudahLewatBatasAbsenMasukWIB(dateWIB(11, 59)), false);
assert.strictEqual(sudahLewatBatasAbsenMasukWIB(dateWIB(12, 0)), true);
assert.strictEqual(sudahLewatBatasAbsenMasukWIB(dateWIB(17, 0)), true);

// Keputusan cutoff harus memakai waktu server, bukan waktuAsli dari klien.
const middlewareAbsensi = baca("backend/src/middleware/kompresFoto.js");
const controllerAbsensi = baca("backend/src/controllers/absensiController.js");
const blokValidasiWaktu = middlewareAbsensi.slice(
  middlewareAbsensi.indexOf("function menitValidasiWIB"),
  middlewareAbsensi.indexOf("async function validasiSebelumUpload"),
);
assert(blockValidasiWaktuAda(blokValidasiWaktu), "Preflight cutoff wajib ada.");
function blockValidasiWaktuAda(blok) {
  return blok.includes("return totalMenitWIB(new Date())") && !blok.includes("waktuAsli");
}
assert(
  controllerAbsensi.includes("const menitSekarangServerWIB = menitSekarangWIB(new Date());"),
  "Controller harus menghitung waktu aktual server secara terpisah dari timestamp offline."
);
assert(
  controllerAbsensi.includes("if (menitSekarangServerWIB >= BATAS_ABSEN_MASUK_WIB)"),
  "Controller wajib menolak absen masuk berdasarkan jam server setelah pukul 12:00."
);
assert(
  !controllerAbsensi.includes("if (menitServerWIB >= BATAS_ABSEN_MASUK_WIB)"),
  "Timestamp offline tidak boleh menjadi satu-satunya dasar cutoff."
);
assert(
  !middlewareAbsensi.slice(middlewareAbsensi.indexOf("function menitValidasiWIB"), middlewareAbsensi.indexOf("async function validasiSebelumUpload")).includes("req.body"),
  "Preflight tidak boleh mempercayai body klien untuk memutuskan cutoff."
);

console.log("Absensi cutoff 12:00 WIB regression test: PASS");
