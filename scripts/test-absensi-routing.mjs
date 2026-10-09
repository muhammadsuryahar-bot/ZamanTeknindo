import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BATAS_ABSEN_MASUK_WIB,
  BATAS_KONFIRMASI_PULANG_WIB,
  PESAN_KONFIRMASI_PULANG_SAJA,
  tentukanEndpointAbsensi,
  perluKonfirmasiPulangSaja,
} from "../src/utils/alurAbsensi.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = fs.readFileSync(path.join(root, "src/pages/DashboardKaryawan.jsx"), "utf8");

assert.equal(BATAS_ABSEN_MASUK_WIB, 720);
assert.equal(BATAS_KONFIRMASI_PULANG_WIB, 1020);
assert.equal(PESAN_KONFIRMASI_PULANG_SAJA,
  "ANDA BELUM MELAKUKAN ABSEN MASUK, APAKAH ANDA AKAN MELAKUKAN ABSEN PULANG SAJA");

// Belum masuk: sebelum cutoff mengarah ke masuk, tepat sejak 12:00 mengarah pulang.
assert.equal(tentukanEndpointAbsensi("belum_masuk", 719), "masuk");
assert.equal(tentukanEndpointAbsensi("belum_masuk", 720), "pulang");
assert.equal(tentukanEndpointAbsensi("belum_masuk", 1019), "pulang");
assert.equal(tentukanEndpointAbsensi("belum_masuk", 1020), "pulang");

// Sudah masuk harus selalu langsung mengarah ke pulang, termasuk rentang 12:00–17:00.
assert.equal(tentukanEndpointAbsensi("sudah_masuk", 720), "pulang");
assert.equal(tentukanEndpointAbsensi("sudah_masuk", 1019), "pulang");
assert.equal(tentukanEndpointAbsensi("sudah_masuk", 1020), "pulang");
assert.equal(tentukanEndpointAbsensi("langsung_pulang", 720), "pulang");
assert.equal(tentukanEndpointAbsensi("selesai", 800), null);
assert.equal(tentukanEndpointAbsensi("tidak_perlu_absen", 800), null);
assert.equal(tentukanEndpointAbsensi("belum_masuk", Number.NaN), null);

// Konfirmasi hanya untuk karyawan tanpa absen masuk pada 12:00 sampai sebelum 17:00.
assert.equal(perluKonfirmasiPulangSaja("langsung_pulang", 719), false);
assert.equal(perluKonfirmasiPulangSaja("langsung_pulang", 720), true);
assert.equal(perluKonfirmasiPulangSaja("langsung_pulang", 1019), true);
assert.equal(perluKonfirmasiPulangSaja("langsung_pulang", 1020), false);
assert.equal(perluKonfirmasiPulangSaja("sudah_masuk", 800), false);
assert.equal(perluKonfirmasiPulangSaja("belum_masuk", 800), false);

// Wiring guard: UI must use the tested route and show the explicit confirmation.
assert.match(dashboard, /tentukanEndpointAbsensi\(tahapKirim, menitAcuanKirim\)/);
assert.match(dashboard, /perluKonfirmasiPulangSaja\(tahapKirim, menitAcuanKirim\)/);
assert.match(dashboard, /window\.confirm\(PESAN_KONFIRMASI_PULANG_SAJA\)/);
assert.match(dashboard, /async function bacaAbsensiTersimpan\(endpoint\)/);

console.log("Absensi route + 12:00–17:00 confirmation regression test: PASS");
