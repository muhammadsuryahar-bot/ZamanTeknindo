const { createClient } = require("@supabase/supabase-js");

const BUCKET_NAME = "absensi";
const SIGNED_URL_TTL_SECONDS = 300;
const SIGNED_URL_CACHE_SECONDS = 180;
const DELETE_RETRY_DELAYS_MS = [300, 900, 1800];

let supabaseClient = null;

function ambilSupabase() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const supabaseServiceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL belum dikonfigurasi di environment variable server.",
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment variable server.",
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  return supabaseClient;
}

function tunggu(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorLayakDiulangi(error) {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  if (statusCode === 408 || statusCode === 425 || statusCode === 429) return true;
  if (statusCode >= 500 && statusCode <= 599) return true;

  const pesan = String(error?.message || "").toLowerCase();
  return (
    pesan.includes("fetch failed") ||
    pesan.includes("network") ||
    pesan.includes("timeout") ||
    pesan.includes("timed out") ||
    pesan.includes("econnreset") ||
    pesan.includes("socket")
  );
}

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
  if (signedUrlCache.size < 1000) return;

  const sekarang = Date.now();
  for (const [path, item] of signedUrlCache) {
    if (item.expiresAt <= sekarang) signedUrlCache.delete(path);
  }
}

async function uploadFotoAbsensi(buffer, filePath, contentType = "image/jpeg") {
  const supabase = ambilSupabase();
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
  const path = String(filePath || "").trim();
  if (!path || path.startsWith("/uploads/")) {
    return { berhasil: false, dilewati: true };
  }

  const supabase = ambilSupabase();
  let errorTerakhir = null;

  for (let percobaan = 0; percobaan <= DELETE_RETRY_DELAYS_MS.length; percobaan += 1) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

      if (!error) {
        signedUrlCache.delete(path);
        return { berhasil: true };
      }

      errorTerakhir = error;
      if (!errorLayakDiulangi(error) || percobaan >= DELETE_RETRY_DELAYS_MS.length) {
        break;
      }
    } catch (error) {
      errorTerakhir = error;
      if (!errorLayakDiulangi(error) || percobaan >= DELETE_RETRY_DELAYS_MS.length) {
        break;
      }
    }

    await tunggu(DELETE_RETRY_DELAYS_MS[percobaan]);
  }

  console.error(
    "Gagal menghapus foto dari Supabase Storage:",
    errorTerakhir?.message || errorTerakhir,
  );

  return {
    berhasil: false,
    pesan: errorTerakhir?.message || "Gagal menghapus foto dari Storage.",
  };
}

async function hapusBatchSekali(supabase, batch) {
  try {
    return await supabase.storage.from(BUCKET_NAME).remove(batch);
  } catch (error) {
    return { data: null, error };
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

  const supabase = ambilSupabase();
  const UKURAN_BATCH = 500;
  let jumlahDihapus = 0;

  for (let i = 0; i < pathUnik.length; i += UKURAN_BATCH) {
    const batch = pathUnik.slice(i, i + UKURAN_BATCH);
    let hasil = null;
    let errorTerakhir = null;

    for (let percobaan = 0; percobaan <= DELETE_RETRY_DELAYS_MS.length; percobaan += 1) {
      const response = await hapusBatchSekali(supabase, batch);
      hasil = response;

      if (!response?.error) {
        jumlahDihapus += batch.length;
        break;
      }

      errorTerakhir = response.error;
      if (!errorLayakDiulangi(response.error) || percobaan >= DELETE_RETRY_DELAYS_MS.length) {
        break;
      }

      await tunggu(DELETE_RETRY_DELAYS_MS[percobaan]);
    }

    if (hasil?.error) {
      throw new Error(
        `Gagal menghapus ${batch.length} foto dari Supabase Storage: ${errorTerakhir?.message || hasil.error.message}`,
      );
    }

    for (const path of batch) signedUrlCache.delete(path);
  }

  return { jumlahDihapus };
}

async function buatSignedUrlFoto(
  filePath,
  expiresIn = SIGNED_URL_TTL_SECONDS,
) {
  if (!filePath) return null;

  const cache = ambilCacheSignedUrl(filePath);
  if (cache) return cache;

  const supabase = ambilSupabase();
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
    const supabase = ambilSupabase();
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
