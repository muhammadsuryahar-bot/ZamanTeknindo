// Script ini dipakai SEKALI SAJA untuk membuat akun Admin pertama.
// Cara pakai (dari terminal, di dalam folder backend):
//   node src/utils/buatAdmin.js

require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./prismaClient");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function tanya(pertanyaan) {
  return new Promise((resolve) => rl.question(pertanyaan, resolve));
}

async function main() {
  console.log("=== Buat Akun Admin Pertama ===\n");

  const nama = await tanya("Nama Admin: ");
  const email = await tanya("Email Admin: ");
  const kataSandi = await tanya("Password Admin (bebas, minimal 6 karakter): ");

  rl.close();

  if (!nama || !email || !kataSandi) {
    console.log("\n❌ Semua data wajib diisi. Coba jalankan ulang.");
    process.exit(1);
  }

  const sudahAda = await prisma.pengguna.findUnique({ where: { email } });
  if (sudahAda) {
    console.log("\n❌ Email ini sudah terdaftar di database. Gunakan email lain.");
    process.exit(1);
  }

  const kataSandiHash = await bcrypt.hash(kataSandi, 10);

  const admin = await prisma.pengguna.create({
    data: {
      nama,
      email,
      kataSandi: kataSandiHash,
      peran: "admin",
      statusAkun: "aktif",
    },
  });

  console.log("\n✅ Akun Admin berhasil dibuat!");
  console.log(`   Nama : ${admin.nama}`);
  console.log(`   Email: ${admin.email}`);
  console.log("\nSekarang kamu bisa login pakai email & password ini.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Terjadi kesalahan:", err);
  process.exit(1);
});
