import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAKS_AKURASI_LOKASI_METER,
  akurasiLokasiLayak,
  pesanKesalahanGeolokasi,
} from "../src/utils/lokasiAbsensi.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = fs.readFileSync(
  path.join(root, "src/pages/DashboardKaryawan.jsx"),
  "utf8",
);
const server = fs.readFileSync(
  path.join(root, "backend/src/controllers/absensiController.js"),
  "utf8",
);

assert.equal(MAKS_AKURASI_LOKASI_METER, 100);
assert.equal(akurasiLokasiLayak(0), false);
assert.equal(akurasiLokasiLayak(-1), false);
assert.equal(akurasiLokasiLayak(Number.NaN), false);
assert.equal(akurasiLokasiLayak(100), true);
assert.equal(akurasiLokasiLayak(20), true);
assert.equal(akurasiLokasiLayak(101), false);
assert.equal(akurasiLokasiLayak(149), false);

assert.match(pesanKesalahanGeolokasi(1), /Izin lokasi ditolak/);
assert.match(pesanKesalahanGeolokasi(2), /Windows\/browser tidak dapat menentukan lokasi/);
assert.match(pesanKesalahanGeolokasi(2), /Wi-Fi/);
assert.match(pesanKesalahanGeolokasi(3), /20 detik/);
assert.match(pesanKesalahanGeolokasi(99), /layanan lokasi perangkat/);

// Production page must diagnose insecure context, browser permission errors,
// Windows location-provider errors, and timeout separately.
assert.match(dashboard, /!window\.isSecureContext/);
assert.match(dashboard, /pesanKesalahanGeolokasi\(errorGeolokasiTerakhir\)/);
assert.match(dashboard, /errorGeolokasiTerakhir === 1/);
assert.match(dashboard, /setStatusLokasi\("mencari"\)/);
assert.match(dashboard, /Perangkat hanya memberikan perkiraan lokasi/);

// Coordinates above the acceptance threshold must never be shown as found,
// retained as a sendable location, or linked on the map.
assert.match(dashboard, /if \(akurasiLokasiLayak\(akurasi\)\)/);
assert.match(dashboard, /setLokasi\(null\);\s*setStatusLokasi\("mencari"\)/);
assert.match(dashboard, /setLokasi\(null\);\s*setStatusLokasi\("gagal"\)/);
assert.match(dashboard, /!akurasiLokasiLayak\(lokasiAkurasi\)/);
assert.match(dashboard, /!akurasiLokasiLayak\(lokasi\?\.akurasi\)/);

// Server remains the final independent authority for the same 100 m limit.
assert.match(server, /const MAKS_AKURASI_LOKASI_METER = 100/);
assert.match(server, /akurasiMeter > MAKS_AKURASI_LOKASI_METER/);

console.log("Absensi geolocation diagnostics + laptop accuracy regression test: PASS");
