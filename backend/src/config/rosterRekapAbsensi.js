// Roster dan metadata HR diambil dari file acuan "REKAP ABSENSI 9 SEPTEMBER 2026(2).xlsx"
// dan menjadi master HR yang dipakai lintas periode sampai HR mengirim pembaruan. Nomor HR sengaja tidak dirapikan
// menjadi urutan 1..22 karena nomor resmi pada file acuan memang memiliki jeda.
// Hanya alias eksplisit yang boleh menghubungkan nama HR ke akun aplikasi.
// Dua nama yang tidak ditemukan di database tetap tampil dengan sel kehadiran kosong;
// jangan menganggap hari kosong sebagai Alpha dan jangan membuat akun/data absensi otomatis.

const PERIODE_METADATA_HR = Object.freeze({
  tanggalMulai: "2026-08-26",
  tanggalSelesai: "2026-09-25",
});

const ROSTER_HR_REKAP = Object.freeze([
  { nomor: 1, nama: "Dimas Buluh T", tmk: "2012-07-01", aliases: ["Dimas Buluh Tenggono"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: "Sdh hbs dijalani" },
  { nomor: 2, nama: "Azwar Effendi", tmk: "2014-09-01", aliases: [], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: "Sdh hbs dijalani" },
  { nomor: 3, nama: "Bidan Tamba", tmk: "2011-11-01", aliases: ["Bidan T"], hc2024_2025: "Sudah hbs dijalani", hc2025_2026: 12 },
  { nomor: 4, nama: "Indah Puji Lestari", tmk: "2014-06-01", aliases: [], hc2024_2025: 6, hc2025_2026: 6 },
  { nomor: 5, nama: "R.Tjuntjun Candra", tmk: "2013-05-01", aliases: ["R. Tjuntjun chandra. P"], hc2024_2025: 12, hc2025_2026: 12 },
  { nomor: 7, nama: "Cindyka Fransiska", tmk: "2015-02-01", aliases: [], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: "Sdh hbs dijalani" },
  { nomor: 8, nama: "Budi Winarso", tmk: "2016-10-04", aliases: ["Budi winarso"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: 12 },
  { nomor: 9, nama: "Novita Ramahyani", tmk: "2017-10-01", aliases: [], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: "Sdh hbs dijalani" },
  { nomor: 10, nama: "Ratna Juwita", tmk: "2018-08-01", aliases: ["Ratnajuwita"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: 12 },
  { nomor: 11, nama: "Sugiono", tmk: "2011-01-01", aliases: ["SUGIONO"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: 12 },
  { nomor: 12, nama: "Fittry S", tmk: "2020-11-03", aliases: ["Fittry Sulistyaningrum"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: 12 },
  { nomor: 14, nama: "Setiyo Widodo", tmk: "2018-11-02", aliases: ["Setiyo widodo"], hc2024_2025: "Sdh hbs dijalani", hc2025_2026: 12 },
  { nomor: 16, nama: "Arie Alfriadi S", tmk: "2024-06-01", aliases: ["Arie Alfriadi Surbakti"], hc2024_2025: "Sudah hbs dijalani", hc2025_2026: "Sdh hbs dijalani" },
  { nomor: 17, nama: "Jihan Adiba", tmk: "2024-05-01", aliases: [], hc2024_2025: "Sudah hbs dijalani", hc2025_2026: 12 },
  { nomor: 19, nama: "Ashabussalam", tmk: "2025-06-10", aliases: [], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: 12 },
  { nomor: 20, nama: "Iqbal Lika Marja", tmk: "2025-06-10", aliases: ["IQBAL LIKA MARJA"], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: "Belum Ada hak Cuti" },
  { nomor: 21, nama: "Edi Ponimin", tmk: "2025-12-08", aliases: [], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: "Belum Ada hak Cuti" },
  { nomor: 22, nama: "Andi Daulay", tmk: "2026-04-07", aliases: ["M. ANDI SEPTIYAN DAULAY"], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: "Belum Ada hak Cuti" },
  { nomor: 23, nama: "M Rafael Harvio P", tmk: "2026-05-18", aliases: [], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: "Belum Ada hak Cuti" },
  { nomor: 24, nama: "Syaza Rafsanjani", tmk: "2026-04-20", aliases: ["Syaza rafsanjani"], hc2024_2025: "Belum Ada hak Cuti", hc2025_2026: "Belum Ada hak Cuti" },
  { nomor: 25, nama: "M Surya Harja", tmk: "2026-08-03", aliases: ["Muhammad Surya Harja"], hc2024_2025: "Mhs Magang", hc2025_2026: null },
  { nomor: 26, nama: "Nur M. Maulanal Hakim", tmk: "2026-08-03", aliases: ["Nur Muhammad Maulanal Hakim"], hc2024_2025: "Mhs Magang", hc2025_2026: null },
]);

module.exports = { PERIODE_METADATA_HR, ROSTER_HR_REKAP };
