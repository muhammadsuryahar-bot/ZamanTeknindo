const rateLimit = require("express-rate-limit");

// Batasi percobaan login: maksimal 8 kali dalam 15 menit per alamat IP.
// Ini mencegah orang coba-coba password berkali-kali (brute-force).
// Kalau kena limit, orang itu harus tunggu sampai jendela waktunya reset,
// tidak permanen diblokir.
const batasLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 8,
  message: { pesan: "Terlalu banyak percobaan login. Coba lagi dalam beberapa menit." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Batasi pendaftaran akun: maksimal 5 kali dalam 1 jam per alamat IP.
// Mencegah orang bikin akun spam berulang-ulang.
const batasDaftar = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5,
  message: { pesan: "Terlalu banyak percobaan pendaftaran dari perangkat ini. Coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { batasLogin, batasDaftar };
