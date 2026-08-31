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
const SIGNED_URL_TTL_SECONDS = 300;
const SIGNED_URL_CACHE_SECONDS = 180;

// Cache memory hanya untuk warm function instance.
// Tidak menggantikan database/storage dan akan hilang ketika instance mati.
const signedUrlCache = new Map();

function ambilCacheSignedUrl(filePath) {
  const cache = signedUrlCache.get(filePath);
  if (!cache) return null;

  if (cache.expiresAt <= Date.now()) {
    signedUrlCache.delete(filePath);
    return null;
  }

  return cache.url;
}

function simpanCacheSignedUrl(filePath, url) {
  if (!filePath || !url) return;

  signedUrlCache.set(filePath, {
    url,
    expiresAt: Date.now() + SIGNED_URL_CACHE_SECONDS * 1000,
  });
}

function bersihkanCacheSignedUrl() {
  // Batasi memory jika instance hidup sangat lama.
  if (signedUrlCache.size < 1000) return;

  const sekarang = Date.now();
  for (const [path, item] of signedUrlCache) {
    if (item.expiresAt <= sekarang) signedUrlCache.delete(path);
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

// Dipakai khusus proses cleanup bulanan.
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

  const cache = ambilCacheSignedUrl(filePath);
  if (cache) return cache;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Gagal membuat URL foto: ${error.message}`);
  }

  simpanCacheSignedUrl(filePath, data.signedUrl);
  bersihkanCacheSignedUrl();

  return data.signedUrl;
}

// ============================================================
// SIGNED URL BATCH DENGAN CACHE MEMORY
// ============================================================
async function buatSignedUrlFotoBatch(
  filePaths,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) {
  const pathUnik = [...new Set(filePaths.filter(Boolean))];

  if (pathUnik.length === 0) return new Map();

  const hasil = new Map();
  const belumAdaCache = [];

  for (const path of pathUnik) {
    const cache = ambilCacheSignedUrl(path);

    if (cache) {
      hasil.set(path, cache);
    } else {
      belumAdaCache.push(path);
    }
  }

  if (belumAdaCache.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(belumAdaCache, expiresIn);

    if (error) {
      console.error("Gagal membuat signed URL batch:", error.message);
      return hasil;
    }

    for (const item of data || []) {
      if (!item.error && item.signedUrl) {
        hasil.set(item.path, item.signedUrl);
        simpanCacheSignedUrl(item.path, item.signedUrl);
      } else if (item.error) {
        console.error(
          `Gagal membuat signed URL untuk ${item.path}:`,
          item.error,
        );
      }
    }
  }

  bersihkanCacheSignedUrl();
  return hasil;
}

module.exports = {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
  deleteFotoAbsensiBatch,
  buatSignedUrlFoto,
  buatSignedUrlFotoBatch,
};
