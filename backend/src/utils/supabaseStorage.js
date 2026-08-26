const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL tidak ditemukan di environment variable");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment variable");
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

const BUCKET_NAME = "absensi";

async function uploadFotoAbsensi(buffer, filePath, contentType = "image/jpeg") {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal upload foto ke Supabase Storage: ${error.message}`);
  }

  return data.path;
}

async function deleteFotoAbsensi(filePath) {
  if (!filePath) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error(
      "Gagal menghapus foto dari Supabase Storage:",
      error.message
    );
  }
}

async function buatSignedUrlFoto(filePath, expiresIn = 300) {
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(
      `Gagal membuat URL foto: ${error.message}`
    );
  }

  return data.signedUrl;
}

// ============================================================
// BUAT SIGNED URL UNTUK BANYAK FOTO SEKALIGUS (1 REQUEST)
// ============================================================
//
// Dipakai kalau butuh signed URL untuk banyak foto dalam satu
// waktu (misal rekap absensi harian). Jauh lebih cepat daripada
// panggil buatSignedUrlFoto() satu-satu di dalam loop, karena
// ini cuma 1 request ke Supabase untuk semua path sekaligus,
// bukan 1 request per foto.
//
// Balikannya berupa Map<filePath, signedUrl> supaya gampang
// di-lookup di pemanggilnya (kalau gagal untuk path tertentu,
// path itu tidak akan ada di Map -- bukan melempar error).
//
async function buatSignedUrlFotoBatch(filePaths, expiresIn = 300) {
  const pathUnik = [...new Set(filePaths.filter(Boolean))];

  if (pathUnik.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(pathUnik, expiresIn);

  if (error) {
    console.error("Gagal membuat signed URL batch:", error.message);
    return new Map();
  }

  const hasil = new Map();

  for (const item of data) {
    // Tiap item bisa punya error sendiri-sendiri (misal file
    // tertentu sudah terhapus dari storage) tanpa bikin
    // seluruh batch gagal.
    if (!item.error && item.signedUrl) {
      hasil.set(item.path, item.signedUrl);
    } else if (item.error) {
      console.error(
        `Gagal membuat signed URL untuk ${item.path}:`,
        item.error
      );
    }
  }

  return hasil;
}

module.exports = {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
  buatSignedUrlFoto,
  buatSignedUrlFotoBatch,
};