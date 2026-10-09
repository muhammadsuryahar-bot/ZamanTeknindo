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
  "Status Karyawan wajib disinkronkan saat tanggal WIB berubah dan tidak ada pengiriman aktif."
);
assert.equal(
  perluSinkronStatusHarian("2026-10-09", "2026-10-09", false),
  false,
  "Tidak perlu menyegarkan status berulang kali selama hari yang sama."
);
assert.equal(
  perluSinkronStatusHarian("2026-10-08", "2026-10-09", true),
  false,
  "Pergantian hari tidak boleh mengganggu pengiriman absensi yang sedang berlangsung."
);
assert.match(dashboard, /window\.setInterval\(periksaPerubahanHari, 15000\)/);
assert.match(dashboard, /setWaktuServerEpochMs\(null\)/);
assert.match(dashboard, /hentikanKamera\(\)/);
assert.match(
  dashboard,
  /Tanggal sudah berganti\. Ambil foto dan lokasi baru/,
  "Jika tanggal berganti saat kamera/foto aktif, bukti lama harus dibatalkan dan pengguna diberi petunjuk."
);

console.log("Karyawan daily rollover regression test: PASS");
