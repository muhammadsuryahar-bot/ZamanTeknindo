// Antrian offline: kalau karyawan absen tapi koneksi internet terputus,
// data absen (foto + lokasi) disimpan di IndexedDB lalu dikirim ulang
// ketika koneksi tersedia kembali.
//
// Setiap item memiliki penggunaId pemiliknya. Saat sinkronisasi, item hanya
// boleh dikirim jika penggunaId item sama dengan pengguna yang sedang login.

const NAMA_DB = "absensi_zaman_offline";
const VERSI_DB = 2;
const NAMA_STORE = "antrian_absen";
const REQUEST_TIMEOUT_MS = 15000;

function bukaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAMA_DB, VERSI_DB);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NAMA_STORE)) {
        db.createObjectStore(NAMA_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function simpanKeAntrian(item) {
  if (item?.penggunaId == null) {
    throw new Error("Identitas pengguna wajib disimpan bersama antrian offline.");
  }
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.add({
      ...item,
      penggunaId: Number(item.penggunaId),
      disimpanPada: Date.now(),
      percobaanKirim: Number(item.percobaanKirim) || 0,
      terakhirGagalPada: null,
      statusTerakhir: null,
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function ambilSemuaAntrian() {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readonly");
    const request = tx.objectStore(NAMA_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function hapusDariAntrian(id) {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const request = tx.objectStore(NAMA_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function jumlahAntrian(penggunaId = null) {
  const semua = await ambilSemuaAntrian();
  if (penggunaId == null) return semua.filter((item) => Number.isInteger(Number(item.penggunaId))).length;
  const aktif = Number(penggunaId);
  if (!Number.isInteger(aktif) || aktif <= 0) return 0;
  return semua.filter((item) => Number(item.penggunaId) === aktif).length;
}

async function catatKegagalanSementara(id, status) {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result;
      if (!item) return resolve();
      item.percobaanKirim = (Number(item.percobaanKirim) || 0) + 1;
      item.terakhirGagalPada = Date.now();
      item.statusTerakhir = status;
      const update = store.put(item);
      update.onsuccess = () => resolve();
      update.onerror = () => reject(update.error);
    };
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

function statusBolehDihapus(status, pesan) {
  const teks = String(pesan || "").toLowerCase();
  if (status === 409) return true;
  return status === 400 && (teks.includes("sudah melakukan absen") || teks.includes("sudah melakukan absensi"));
}

async function fetchDenganTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sinkronkanAntrian({ apiUrl, getToken, penggunaId }) {
  const semua = await ambilSemuaAntrian();
  let berhasil = 0;
  let gagal = 0;
  let tidakCocok = 0;
  let perluLogin = 0;
  const penggunaIdAktif = Number(penggunaId);

  if (!Number.isInteger(penggunaIdAktif) || penggunaIdAktif <= 0 || !getToken()) {
    return { berhasil: 0, gagal: semua.length, tidakCocok: 0, perluLogin: semua.length };
  }

  const token = getToken();

  for (const item of semua) {
    if (Number(item.penggunaId) !== penggunaIdAktif) {
      tidakCocok++;
      continue;
    }

    try {
      const formData = new FormData();
      formData.append("foto", item.foto, "absen.jpg");
      if (item.latitude != null) formData.append("latitude", item.latitude);
      if (item.longitude != null) formData.append("longitude", item.longitude);
      if (item.alamat) formData.append("alamat", item.alamat);
      if (item.waktuAsli) formData.append("waktuAsli", item.waktuAsli);

      const respons = await fetchDenganTimeout(`${apiUrl}/absensi/${item.endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let data = {};
      try { data = await respons.json(); } catch { data = {}; }

      if (respons.ok) {
        await hapusDariAntrian(item.id);
        berhasil++;
        continue;
      }

      if (respons.status === 401 || respons.status === 403 || respons.status >= 500 || respons.status === 408 || respons.status === 429) {
        await catatKegagalanSementara(item.id, respons.status);
        gagal++;
        if (respons.status === 401 || respons.status === 403) perluLogin++;
        continue;
      }

      if (statusBolehDihapus(respons.status, data?.pesan)) {
        await hapusDariAntrian(item.id);
      } else {
        await catatKegagalanSementara(item.id, respons.status);
      }
      gagal++;
    } catch (err) {
      console.warn("Gagal sinkron item offline:", err);
      await catatKegagalanSementara(item.id, err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
      gagal++;
    }
  }

  return { berhasil, gagal, tidakCocok, perluLogin };
}
