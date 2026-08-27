// Antrian offline: kalau karyawan absen tapi koneksi internet terputus,
// data absen (foto + lokasi) disimpan di IndexedDB lalu dikirim ulang
// ketika koneksi tersedia kembali.
//
// KEAMANAN PENTING:
// Setiap item antrian menyimpan penggunaId pemiliknya. Saat sinkronisasi,
// item HANYA boleh dikirim jika penggunaId item sama dengan pengguna yang
// sedang login. Ini mencegah data Karyawan A terkirim memakai token
// Karyawan B pada perangkat yang sama.
//
// Data lama yang dibuat sebelum field penggunaId tersedia TIDAK akan
// dikirim otomatis karena identitas pemiliknya tidak bisa diverifikasi.

const NAMA_DB = "absensi_zaman_offline";
const VERSI_DB = 2;
const NAMA_STORE = "antrian_absen";

function bukaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAMA_DB, VERSI_DB);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(NAMA_STORE)) {
        db.createObjectStore(NAMA_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
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
    const store = tx.objectStore(NAMA_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function hapusDariAntrian(id) {
  const db = await bukaDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function jumlahAntrian(penggunaId = null) {
  const semua = await ambilSemuaAntrian();

  if (penggunaId == null) {
    return semua.filter((item) => Number.isInteger(Number(item.penggunaId))).length;
  }

  const penggunaIdAktif = Number(penggunaId);

  if (!Number.isInteger(penggunaIdAktif) || penggunaIdAktif <= 0) {
    return 0;
  }

  return semua.filter(
    (item) => Number(item.penggunaId) === penggunaIdAktif,
  ).length;
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

      item.percobaanKirim = Number(item.percobaanKirim) || 0;
      item.percobaanKirim += 1;
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
  // Hapus hanya kalau server secara jelas menyatakan data tersebut
  // ditolak sebagai duplikat/aksi yang sudah selesai. Untuk 401/403/5xx,
  // data dipertahankan supaya tidak hilang hanya karena sesi/server sedang
  // bermasalah.
  const teks = String(pesan || "").toLowerCase();

  if (status === 409) return true;

  if (
    status === 400 &&
    (teks.includes("sudah melakukan absen") ||
      teks.includes("sudah melakukan absensi"))
  ) {
    return true;
  }

  return false;
}

export async function sinkronkanAntrian({ apiUrl, getToken, penggunaId }) {
  const semua = await ambilSemuaAntrian();
  let berhasil = 0;
  let gagal = 0;
  let tidakCocok = 0;
  let perluLogin = 0;

  const penggunaIdAktif = Number(penggunaId);

  if (!Number.isInteger(penggunaIdAktif) || penggunaIdAktif <= 0) {
    return {
      berhasil: 0,
      gagal: semua.length,
      tidakCocok: 0,
      perluLogin: semua.length,
    };
  }

  const token = getToken();

  if (!token) {
    return {
      berhasil: 0,
      gagal: semua.length,
      tidakCocok: 0,
      perluLogin: semua.length,
    };
  }

  for (const item of semua) {
    // Jangan pernah mengirim item tanpa identitas pemilik yang jelas.
    if (Number(item.penggunaId) !== penggunaIdAktif) {
      tidakCocok++;
      continue;
    }

    try {
      const formData = new FormData();

      formData.append("foto", item.foto, "absen.jpg");

      if (item.latitude != null) {
        formData.append("latitude", item.latitude);
      }

      if (item.longitude != null) {
        formData.append("longitude", item.longitude);
      }

      if (item.alamat) {
        formData.append("alamat", item.alamat);
      }

      if (item.waktuAsli) {
        formData.append("waktuAsli", item.waktuAsli);
      }

      const respons = await fetch(`${apiUrl}/absensi/${item.endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      let data = {};

      try {
        data = await respons.json();
      } catch {
        // Biarkan data tetap {} kalau response bukan JSON.
      }

      if (respons.ok) {
        await hapusDariAntrian(item.id);
        berhasil++;
        continue;
      }

      // Sesi/account bermasalah: JANGAN hapus data offline.
      // Karyawan harus login/aktif lagi, lalu antrian dicoba ulang.
      if (respons.status === 401 || respons.status === 403) {
        await catatKegagalanSementara(item.id, respons.status);
        gagal++;
        perluLogin++;
        continue;
      }

      // Server sedang bermasalah: JANGAN hapus.
      if (respons.status >= 500) {
        await catatKegagalanSementara(item.id, respons.status);
        gagal++;
        continue;
      }

      // 408 Request Timeout dan 429 Too Many Requests juga sifatnya
      // sementara, jadi item tetap dipertahankan.
      if (respons.status === 408 || respons.status === 429) {
        await catatKegagalanSementara(item.id, respons.status);
        gagal++;
        continue;
      }

      // Untuk penolakan 4xx lain, hanya hapus jika respons jelas menunjukkan
      // bahwa item sudah diproses/duplikat. Selain itu pertahankan datanya.
      if (statusBolehDihapus(respons.status, data?.pesan)) {
        await hapusDariAntrian(item.id);
      } else {
        await catatKegagalanSementara(item.id, respons.status);
      }

      gagal++;
    } catch (err) {
      // Network error: data tetap dipertahankan.
      console.warn("Gagal sinkron item offline:", err);
      await catatKegagalanSementara(item.id, "NETWORK_ERROR");
      gagal++;
    }
  }

  return {
    berhasil,
    gagal,
    tidakCocok,
    perluLogin,
  };
}
