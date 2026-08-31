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
const SIGNED_URL_TTL_SECONDS = 240;
const SIGNED_URL_CACHE_MS = 180000;

// Cache hanya berada di memory instance yang sedang hidup.
// Tujuannya mengurangi pembuatan signed URL berulang saat Dashboard Admin
// dibuka/di-refresh pada instance server yang sama. Cache tidak menjadi
// sumber kebenaran dan akan hilang ketika instance server dihentikan.
const signedUrlCache = new Map();

function bersihkanCacheKadaluarsa() {
  const sekarang = Date.now();
  for (const [path, value] of signedUrlCache.entries()) {
    if (value.expiresAt <= sekarang) {
      signedUrlCache.delete(path);
    }
  }
}

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

async function buatSignedUrlFoto(filePath, expiresIn = SIGNED_URL_TTL_SECONDS) {
  if (!filePath) return null;

  bersihkanCacheKadaluarsa();

  const cached = signedUrlCache.get(filePath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Gagal membuat URL foto: ${error.message}`);
  }

  if (data?.signedUrl) {
    signedUrlCache.set(filePath, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
    });
  }

  return data.signedUrl;
}

async function buatSignedUrlFotoBatch(
  filePaths,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) {
  const pathUnik = [
    ...new Set(
      filePaths
        .filter(Boolean)
        .map((path) => String(path).trim())
        .filter(Boolean),
    ),
  ];

  if (pathUnik.length === 0) return new Map();

  bersihkanCacheKadaluarsa();

  const sekarang = Date.now();
  const hasil = new Map();
  const belumDicache = [];

  for (const path of pathUnik) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > sekarang) {
      hasil.set(path, cached.url);
    } else {
      belumDicache.push(path);
    }
  }

  if (belumDicache.length === 0) return hasil;

  // Tetap 1 request batch untuk path yang belum ada di cache.
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(belumDicache, expiresIn);

  if (error) {
    console.error("Gagal membuat signed URL batch:", error.message);
    return hasil;
  }

  for (const item of data || []) {
    if (!item.error && item.signedUrl) {
      hasil.set(item.path, item.signedUrl);
      signedUrlCache.set(item.path, {
        url: item.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
      });
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
