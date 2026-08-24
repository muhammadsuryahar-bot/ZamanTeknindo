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

module.exports = {
  uploadFotoAbsensi,
  deleteFotoAbsensi,
  buatSignedUrlFoto,
};