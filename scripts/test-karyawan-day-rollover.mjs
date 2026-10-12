import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { perluSinkronStatusHarian } from "../src/utils/statusHarian.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = fs.readFileSync(path.join(root, "src/pages/DashboardKaryawan.jsx"), "utf8");

assert.equal(
  perluSinkronStatusHarian("2026-10-08", "2026-10-09", false),
  true,
  "Status Karyawan wajib disinkronkan ketika tanggal WIB berganti."
);
assert.equal(
  perluSinkronStatusHarian("2026-10-09", "2026-10-09", false),
  false,
  "Tanggal yang sama tidak perlu memicu reset status."
);
assert.equal(
  perluSinkronStatusHarian("2026-10-08", "2026-10-09", true),
  false,
  "Pergantian hari tidak boleh memutus pengiriman absensi yang sedang berlangsung."
);
assert.match(dashboard, /window\.setInterval\(periksaPerubahanHari, 15000\)/);
assert.match(dashboard, /setWaktuServerEpochMs\(null\)/);
assert.match(dashboard, /hentikanKamera\(\)/);
assert.match(
  dashboard,
  /Tanggal sudah berganti\. Ambil foto dan lokasi baru/,
  "Bukti kamera/foto lama harus dibatalkan saat tanggal berubah di tengah sesi."
);

console.log("Karyawan daily rollover regression test: PASS");
