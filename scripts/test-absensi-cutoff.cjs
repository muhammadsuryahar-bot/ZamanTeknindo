const assert = require("assert");
const {
  BATAS_ABSEN_MASUK_WIB,
  totalMenitWIB,
  sudahLewatBatasAbsenMasukWIB,
} = require("../backend/src/utils/waktuIndonesia");

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

console.log("Absensi cutoff 12:00 WIB regression test: PASS");
