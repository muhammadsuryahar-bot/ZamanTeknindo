// Antrian offline: kalau karyawan absen tetapi koneksi internet terputus,
// data absen (foto + lokasi) disimpan di IndexedDB lalu dikirim ulang
// ketika koneksi tersedia kembali.
//
// Setiap item memiliki penggunaId pemiliknya. Saat sinkronisasi, item hanya
// boleh dikirim jika penggunaId item sama dengan pengguna yang sedang login.

const NAMA_DB = "absensi_zaman_offline";
const VERSI_DB = 3;
const NAMA_STORE = "antrian_absen";
const REQUEST_TIMEOUT_MS = 15000;
const HEADER_BACKGROUND = "X-Zaman-Background";
const TIMEZONE_WIB = "Asia/Jakarta";

function tanggalWIBDariISO(waktu) {
  if (!waktu) return null;
  const date = new Date(waktu);
  if (Number.isNaN(date.getTime())) return null;

  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const hasil = {};
  for (const part of bagian) {
    if (part.type !== "literal") hasil[part.type] = part.value;
  }

  if (!hasil.year || !hasil.month || !hasil.day) return null;
  return `${hasil.year}-${hasil.month}-${hasil.day}`;
}

function tanggalWIBHariIni() {
  return tanggalWIBDariISO(new Date().toISOString());
}

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

  const waktuAsli = item?.waktuAsli || new Date().toISOString();
  const tanggalAbsensi = item?.tanggalAbsensi || tanggalWIBDariISO(waktuAsli);
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.add({
      ...item,
      penggunaId: Number(item.penggunaId),
      waktuAsli,
      tanggalAbsensi,
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
  const tanggalHariIni = tanggalWIBHariIni();

  if (penggunaId == null) {
    return semua.filter((item) => {
      const tanggalItem = item.tanggalAbsensi || tanggalWIBDariISO(item.waktuAsli);
      return Number.isInteger(Number(item.penggunaId)) && tanggalItem === tanggalHariIni;
    }).length;
  }

  const aktif = Number(penggunaId);
  if (!Number.isInteger(aktif) || aktif <= 0) return 0;
  return semua.filter((item) => {
    const tanggalItem = item.tanggalAbsensi || tanggalWIBDariISO(item.waktuAsli);
    return Number(item.penggunaId) === aktif && tanggalItem === tanggalHariIni;
  }).length;
}

async function tandaiStatusItem(id, status) {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result;
      if (!item) {
        resolve();
        return;
      }

      item.statusTerakhir = status;
      const update = store.put(item);
      update.onsuccess = () => resolve();
      update.onerror = () => reject(update.error);
    };

    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function catatKegagalanSementara(id, status) {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result;
      if (!item) {
        resolve();
        return;
      }

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

  if (status === 400) {
    return (
      teks.includes("sudah melakukan absen") ||
      teks.includes("sudah melakukan absensi") ||
      teks.includes("absensi tidak diperlukan")
    );
  }

  return false;
}

async function fetchDenganTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function rekonsiliasiAntrian({ apiUrl, getToken, penggunaId }) {
  const penggunaIdAktif = Number(penggunaId);
  const token = getToken?.();

  if (!Number.isInteger(penggunaIdAktif) || penggunaIdAktif <= 0 || !token || !navigator.onLine) {
    return { dihapus: 0, tahap: null };
  }

  try {
    const respons = await fetchDenganTimeout(`${apiUrl}/absensi/status-hari-ini`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [HEADER_BACKGROUND]: "offline-reconciliation",
      },
    });

    if (!respons.ok) return { dihapus: 0, tahap: null };

    const data = await respons.json();
    const tahap = data?.tahap;
    const tanggalServer = String(data?.tanggal || tanggalWIBHariIni() || "");
    const semua = await ambilSemuaAntrian();
    let dihapus = 0;

    for (const item of semua) {
      if (Number(item.penggunaId) !== penggunaIdAktif) continue;

      const tanggalItem = item.tanggalAbsensi || tanggalWIBDariISO(item.waktuAsli);
      if (!tanggalItem || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalItem)) continue;
      if (tanggalItem !== tanggalServer) continue;

      const sudahTercatat =
        tahap === "tidak_perlu_absen" ||
        (tahap === "sudah_masuk" && item.endpoint === "masuk") ||
        (tahap === "selesai" && (item.endpoint === "masuk" || item.endpoint === "pulang"));

      if (!sudahTercatat) continue;

      await hapusDariAntrian(item.id);
      dihapus++;
    }

    return { dihapus, tahap };
  } catch (error) {
    console.warn("Rekonsiliasi antrean offline belum berhasil:", error);
    return { dihapus: 0, tahap: null };
  }
}

export async function verifikasiDanBersihkanAntrian(args) {
  return rekonsiliasiAntrian(args);
}

let sinkronisasiAktif = null;

export async function sinkronkanAntrian({ apiUrl, getToken, penggunaId }) {
  if (sinkronisasiAktif) return sinkronisasiAktif;

  sinkronisasiAktif = (async () => {
    const semua = await ambilSemuaAntrian();
    let berhasil = 0;
    let gagal = 0;
    let tidakCocok = 0;
    let perluLogin = 0;
    let kedaluwarsa = 0;
    const penggunaIdAktif = Number(penggunaId);
    const tanggalHariIni = tanggalWIBHariIni();

    if (!Number.isInteger(penggunaIdAktif) || penggunaIdAktif <= 0 || !getToken()) {
      return {
        berhasil: 0,
        gagal: semua.length,
        tidakCocok: 0,
        perluLogin: semua.length,
        kedaluwarsa: 0,
      };
    }

    const token = getToken();

    for (const item of semua) {
      if (Number(item.penggunaId) !== penggunaIdAktif) {
        tidakCocok++;
        continue;
      }

      const tanggalItem = item.tanggalAbsensi || tanggalWIBDariISO(item.waktuAsli);
      if (tanggalItem !== tanggalHariIni) {
        kedaluwarsa++;
        await tandaiStatusItem(item.id, "STALE_DATE");
        continue;
      }

      if (!item.foto || !item.endpoint || !["masuk", "pulang"].includes(item.endpoint)) {
        await catatKegagalanSementara(item.id, "INVALID_LOCAL_QUEUE");
        gagal++;
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("foto", item.foto, "absen.jpg");
        if (item.latitude != null) formData.append("latitude", String(item.latitude));
        if (item.longitude != null) formData.append("longitude", String(item.longitude));
        if (item.alamat) formData.append("alamat", item.alamat);
        if (item.waktuAsli) formData.append("waktuAsli", item.waktuAsli);

        const respons = await fetchDenganTimeout(`${apiUrl}/absensi/${item.endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            [HEADER_BACKGROUND]: "offline-sync",
          },
          body: formData,
        });

        let data = {};
        try {
          data = await respons.json();
        } catch {
          data = {};
        }

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
        await catatKegagalanSementara(
          item.id,
          err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        );
        gagal++;
      }
    }

    const rekonsiliasi = await rekonsiliasiAntrian({ apiUrl, getToken, penggunaId });

    return {
      berhasil,
      gagal,
      tidakCocok,
      perluLogin,
      kedaluwarsa,
      direkonsiliasi: rekonsiliasi.dihapus,
      tahapServer: rekonsiliasi.tahap,
    };
  })();

  try {
    return await sinkronisasiAktif;
  } finally {
    sinkronisasiAktif = null;
  }
}
