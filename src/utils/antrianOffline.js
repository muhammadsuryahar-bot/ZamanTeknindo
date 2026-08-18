// Antrian offline: kalau karyawan absen tapi sinyal internetnya lagi
// jelek/putus, data absen (foto + lokasi) TIDAK hilang -- disimpan dulu
// di penyimpanan lokal HP (IndexedDB), lalu otomatis dikirim ulang
// begitu sinyal balik normal.
//
// Kenapa IndexedDB, bukan localStorage? Karena foto (Blob/File) tidak
// bisa disimpan di localStorage (cuma nerima teks). IndexedDB bisa
// nyimpen data biner kayak foto langsung, tanpa perlu diubah jadi teks
// base64 dulu (yang bikin ukurannya membengkak ~33%).

const NAMA_DB = "absensi_zaman_offline";
const VERSI_DB = 1;
const NAMA_STORE = "antrian_absen";

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

// Simpan satu percobaan absen yang gagal terkirim karena masalah jaringan
// (bukan gagal karena validasi server -- itu beda kasus, lihat penjelasan
// di DashboardKaryawan.jsx bagian catch pada kirimAbsen()).
export async function simpanKeAntrian(item) {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    const request = store.add({ ...item, disimpanPada: Date.now() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
  });
}

export async function jumlahAntrian() {
  const semua = await ambilSemuaAntrian();
  return semua.length;
}

// Coba kirim ulang SEMUA absen yang masih tertahan di antrian.
// Dipanggil otomatis: (1) begitu halaman absen dibuka & internet nyala,
// (2) begitu event "online" browser terdeteksi (sinyal baru balik).
// Mengembalikan { berhasil, gagal } supaya UI bisa kasih tahu hasilnya.
export async function sinkronkanAntrian({ apiUrl, getToken }) {
  const semua = await ambilSemuaAntrian();
  let berhasil = 0;
  let gagal = 0;

  for (const item of semua) {
    try {
      const formData = new FormData();
      formData.append("foto", item.foto, "absen.jpg");
      if (item.latitude != null) formData.append("latitude", item.latitude);
      if (item.longitude != null) formData.append("longitude", item.longitude);
      if (item.alamat) formData.append("alamat", item.alamat);

      const respons = await fetch(`${apiUrl}/absensi/${item.endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (respons.ok) {
        await hapusDariAntrian(item.id);
        berhasil++;
      } else {
        // Ditolak SERVER (misal "sudah absen hari ini") -- bukan soal
        // jaringan lagi, jadi tetap dihapus dari antrian supaya tidak
        // nyangkut selamanya nyoba kirim yang memang tidak akan pernah
        // diterima.
        await hapusDariAntrian(item.id);
        gagal++;
      }
    } catch (err) {
      // Masih gagal karena jaringan -- biarkan tetap di antrian,
      // coba lagi nanti di kesempatan berikutnya.
      gagal++;
    }
  }

  return { berhasil, gagal };
}
