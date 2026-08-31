const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL tidak ditemukan di environment variable");
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment variable",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
      error.message,
    );
  }
}

// Dipakai khusus proses cleanup bulanan.
// Supabase membatasi remove maksimal 1000 object per request, jadi fungsi
// ini otomatis memecah daftar foto menjadi batch agar aman.
// Berbeda dengan deleteFotoAbsensi(), fungsi ini MELEMPAR ERROR jika salah
// satu batch gagal. Dengan begitu record database tidak ikut dihapus bila
// Storage belum berhasil dibersihkan.
async function deleteFotoAbsensiBatch(filePaths) {
  const pathUnik = [
    ...new Set(
      filePaths
        .filter(Boolean)
        .map((path) => String(path).trim())
        .filter((path) => path && !path.startsWith("/uploads/")),
    ),
  ];

  if (pathUnik.length === 0) {
    return { jumlahDihapus: 0 };
  }

  const UKURAN_BATCH = 500;
  let jumlahDihapus = 0;

  for (let i = 0; i < pathUnik.length; i += UKURAN_BATCH) {
    const batch = pathUnik.slice(i, i + UKURAN_BATCH);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(batch);

    if (error) {
      throw new Error(
        `Gagal menghapus ${batch.length} foto dari Supabase Storage: ${error.message}`,
      );
    }

    jumlahDihapus += batch.length;
  }

  return { jumlahDihapus };
}

async function buatSignedUrlFoto(filePath, expiresIn = 300) {
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Gagal membuat URL foto: ${error.message}`);
  }

  return data.signedUrl;
}

// ============================================================
// BUAT SIGNED URL UNTUK BANYAK FOTO SEKALIGUS (1 REQUEST)
// ============================================================
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
    if (!item.error && item.signedUrl) {
      hasil.set(item.path, item.signedUrl);
    } else if (item.error) {
      console.error(
        `Gagal membuat signed URL untuk ${item.path}:`,
        item.error,
      );
    }
  }

  return hasil;
}

module.exports = {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
  deleteFotoAbsensiBatch,
  buatSignedUrlFoto,
  buatSignedUrlFotoBatch,
};
