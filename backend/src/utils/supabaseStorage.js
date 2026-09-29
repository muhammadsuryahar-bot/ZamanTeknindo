const { createClient } = require('@supabase/supabase-js');

// Pakai SERVICE_ROLE biar bisa createSignedUrl
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL atau KEY belum di set di .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Bucket production proyek adalah `absensi`; nama lama tetap didukung.
const CANDIDATE_BUCKETS = [
  process.env.SUPABASE_BUCKET_FOTO,
  'absensi',
  'foto-absensi',
  'foto',
].filter((bucket, index, buckets) => bucket && buckets.indexOf(bucket) === index);

function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

const SIGNED_URL_CACHE_TTL_MS = 10 * 60 * 1000;
const signedUrlCache = new Map();

function ambilDariCache(path) {
  const item = signedUrlCache.get(path);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    signedUrlCache.delete(path);
    return null;
  }
  return item.url;
}

function simpanKeCache(path, url) {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS });
}

async function cariUrlFoto(path) {
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('/uploads/')) {
    return path;
  }
  const cached = ambilDariCache(path);
  if (cached) return cached;
  let foundUrl = null;
  for (const bucket of CANDIDATE_BUCKETS) {
    try {
      const { data: signed, error: errSigned } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
      if (!errSigned && signed?.signedUrl) {
        foundUrl = signed.signedUrl;
        break;
      }
      if (errSigned) console.error('[foto-debug] createSignedUrl gagal di bucket ' + bucket + ':', errSigned.message || errSigned);
      const publicUrl = getPublicUrl(bucket, path);
      if (publicUrl) {
        try {
          const headRes = await fetch(publicUrl, { method: 'HEAD' });
          if (headRes.ok) { foundUrl = publicUrl; break; }
        } catch (err) {
          console.error('[foto-debug] fetch HEAD error:', err.message);
        }
      }
    } catch (e) {
      console.error('[foto] error bucket ' + bucket + ' path ' + path, e.message);
    }
  }
  if (!foundUrl) {
    const fallbackBucket = CANDIDATE_BUCKETS[0] || 'absensi';
    foundUrl = getPublicUrl(fallbackBucket, path);
  }
  if (foundUrl && !foundUrl.startsWith('/uploads/')) simpanKeCache(path, foundUrl);
  return foundUrl;
}

async function buatSignedUrlFotoBatch(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const map = new Map();
  if (uniquePaths.length === 0) return map;
  const hasil = await Promise.all(uniquePaths.map(async (path) => [path, await cariUrlFoto(path)]));
  for (const [path, url] of hasil) {
    if (url) map.set(path, url);
  }
  console.log('[foto] buatSignedUrlFotoBatch: ' + map.size + '/' + uniquePaths.length + ' berhasil (paralel/cache)');
  return map;
}
async function uploadFotoAbsensi(buffer, filePath, mimeType = "image/jpeg") {
  let errorTerakhir = null;

  for (const bucket of CANDIDATE_BUCKETS) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (!error) {
      console.log(`[foto] Upload berhasil ke ${bucket}/${data.path}`);
      return data.path;
    }

    errorTerakhir = error;
    console.error(`[foto] Gagal upload ke ${bucket}/${filePath}:`, error.message);
  }

  throw new Error(
    `Upload foto gagal pada semua bucket (${CANDIDATE_BUCKETS.join(", ")}): ${errorTerakhir?.message || "konfigurasi Storage tidak tersedia"}`,
  );
}

async function deleteFotoAbsensi(filePath) {
  if (!filePath) return;
  const bucket = CANDIDATE_BUCKETS[0] || "absensi";
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) {
    console.error(`[foto] Gagal hapus ${bucket}/${filePath}:`, error.message);
  }
}

module.exports = { buatSignedUrlFotoBatch, getPublicUrl, uploadFotoAbsensi, deleteFotoAbsensi };
