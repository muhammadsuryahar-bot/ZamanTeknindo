/* Perbaikan UI Admin yang benar-benar diperlukan. Logic halaman lain tidak diubah. */
if (typeof document !== "undefined" && !document.getElementById("zaman-admin-fixes-style")) {
  const style = document.createElement("style");
  style.id = "zaman-admin-fixes-style";
  style.textContent = `
    /* Rekap memakai .main-area-admin sebagai SATU-SATUNYA vertical scroll owner.
       Tabel Rekap hanya boleh horizontal scroll. */
    .main-area-admin:has(.tableHint) .tableWrap {
      overflow-x: auto !important;
      overflow-y: hidden !important;
      max-height: none !important;
      height: auto !important;
      -webkit-overflow-scrolling: touch;
    }
    .main-area-admin:has(.tableHint) .tableWrap table {
      height: auto !important;
    }

    /* Kantor & Homebase: Admin cukup mengisi nama + alamat. */
    .main-area-admin input[inputmode="decimal"] {
      display: none !important;
    }
    .main-area-admin section:has(input[placeholder="Alamat kantor"]) .formGrid::after {
      content: "Koordinat lokasi ditentukan otomatis dari alamat saat disimpan.";
      display: block;
      grid-column: 1 / -1;
      color: #8A93A3;
      font-size: 11px;
      line-height: 1.45;
    }
    .main-area-admin section:has(input[placeholder="Alamat kantor"]) .formActions > button:first-child {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/* Saat Admin menyimpan Kantor/Homebase, alamat diubah menjadi koordinat
   terlebih dahulu. Endpoint lain dan request GET tidak disentuh. */
if (typeof window !== "undefined" && !window.__zamanOfficeGeocodeBridge) {
  const fetchAsli = window.fetch.bind(window);
  window.__zamanOfficeGeocodeBridge = true;

  const geocodeAlamat = async (alamat) => {
    const teks = String(alamat || "").trim();
    if (!teks) throw new Error("Alamat kantor wajib diisi.");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    try {
      const q = encodeURIComponent(`${teks}, Indonesia`);
      const response = await fetchAsli(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=${q}`,
        { signal: controller.signal, headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`Lokasi alamat belum berhasil dicari (HTTP ${response.status}).`);
      const data = await response.json();
      const hasil = Array.isArray(data) ? data[0] : null;
      const latitude = Number(hasil?.lat);
      const longitude = Number(hasil?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Alamat belum berhasil ditemukan. Lengkapi jalan, kecamatan, kota, dan provinsi.");
      }
      return { latitude: latitude.toFixed(7), longitude: longitude.toFixed(7) };
    } finally {
      window.clearTimeout(timer);
    }
  };

  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    let pathname = requestUrl;
    try { pathname = new URL(requestUrl, window.location.origin).pathname; } catch { /* gunakan string apa adanya */ }

    const isOfficeWrite = method !== "GET" && method !== "HEAD" && /\/admin\/kantor(?:\/[^/]+)?$/.test(pathname);
    if (!isOfficeWrite || typeof init?.body !== "string") return fetchAsli(input, init);

    let payload;
    try { payload = JSON.parse(init.body); } catch { return fetchAsli(input, init); }
    if (!payload || typeof payload !== "object" || !String(payload.alamat || "").trim()) {
      return fetchAsli(input, init);
    }

    const koordinat = await geocodeAlamat(payload.alamat);
    return fetchAsli(input, { ...init, body: JSON.stringify({ ...payload, ...koordinat }) });
  };
}

/*
 * GPS session guard:
 * setiap kali tampilan kamera benar-benar dibuka sebagai sesi baru, lokasi
 * global dari sesi kamera sebelumnya dibuang. Jadi koordinat lama tidak bisa
 * membuat tombol "Ambil Foto" terlihat siap sebelum GPS sesi baru menemukan
 * lokasi yang memenuhi syarat.
 */
if (typeof window !== "undefined" && !window.__zamanKameraLocationSessionGuard) {
  let kameraTerlihat = false;

  const sinkronkanSesiLokasiKamera = () => {
    const kameraSekarangTerlihat = Boolean(document.querySelector(".cameraSection"));

    if (kameraSekarangTerlihat && !kameraTerlihat) {
      window.__zamanLokasiTerakhir = null;
      window.__zamanLokasiSudahDitemukan = false;
      window.__zamanLokasiSesiAktif = true;
      window.__zamanLokasiSesiMulaiPada = Date.now();
    }

    if (!kameraSekarangTerlihat && kameraTerlihat) {
      window.__zamanLokasiSudahDitemukan = false;
      window.__zamanLokasiSesiAktif = false;
    }

    kameraTerlihat = kameraSekarangTerlihat;
  };

  const observer = new MutationObserver(sinkronkanSesiLokasiKamera);
  const pasangObserver = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      sinkronkanSesiLokasiKamera();
      return true;
    }
    return false;
  };

  if (!pasangObserver()) {
    window.addEventListener("DOMContentLoaded", pasangObserver, { once: true });
  }

  const interval = window.setInterval(sinkronkanSesiLokasiKamera, 250);
  window.addEventListener("pagehide", () => {
    observer.disconnect();
    window.clearInterval(interval);
  }, { once: true });

  window.__zamanKameraLocationSessionGuard = true;
}

/*
 * Optimasi GPS untuk HP:
 * - GPS presisi tinggi tetap berjalan sejak awal.
 * - Lokasi cache/network dicoba LANGSUNG, bukan menunggu 1,2 detik.
 * - Percobaan ringan kedua dilakukan sekitar detik ke-2,5 bila belum ada fix.
 * - Callback tetap mengirim semua kandidat ke DashboardKaryawan; Dashboard
 *   sendiri tetap mewajibkan akurasi <= 75 m sebelum foto boleh diambil/dikirim.
 * Jadi yang dipercepat adalah jalur mendapatkan kandidat lokasi, bukan menurunkan
 * syarat akurasi absensi.
 *
 * File ini dievaluasi sebelum body main.jsx, sehingga adapter utama di main.jsx
 * melihat flag ini dan tidak memasang adapter geolocation kedua.
 */
if (typeof window !== "undefined" && !window.__zamanGeolocationFallbackTerpasang) {
  const geolocation = navigator.geolocation;
  const watchAsli = geolocation?.watchPosition?.bind(geolocation);
  const currentAsli = geolocation?.getCurrentPosition?.bind(geolocation);
  const clearAsli = geolocation?.clearWatch?.bind(geolocation);

  if (geolocation && watchAsli && currentAsli && clearAsli) {
    const watchRecords = new Map();
    let nextId = 1;

    const bersihkanWatch = (id) => {
      const record = watchRecords.get(id);
      if (!record) return;

      record.aktif = false;
      if (record.fastTimer) window.clearTimeout(record.fastTimer);
      if (record.secondTimer) window.clearTimeout(record.secondTimer);
      if (record.nativeWatchId !== null) clearAsli(record.nativeWatchId);
      watchRecords.delete(id);
    };

    const buatKandidat = (position) => ({
      latitude: Number(position?.coords?.latitude),
      longitude: Number(position?.coords?.longitude),
      accuracy: Number(position?.coords?.accuracy),
      pada: Date.now(),
    });

    const kandidatValid = (candidate) =>
      Number.isFinite(candidate.latitude) &&
      Number.isFinite(candidate.longitude) &&
      Number.isFinite(candidate.accuracy) &&
      candidate.accuracy > 0;

    geolocation.watchPosition = (success, error, options = {}) => {
      const id = nextId++;
      const record = {
        aktif: true,
        nativeWatchId: null,
        fastTimer: null,
        secondTimer: null,
      };
      watchRecords.set(id, record);

      const kirimSuccess = (position) => {
        if (!record.aktif) return;

        const candidate = buatKandidat(position);
        if (kandidatValid(candidate)) {
          const previous = window.__zamanLokasiTerakhir;
          const previousValid =
            previous &&
            Number.isFinite(previous.latitude) &&
            Number.isFinite(previous.longitude) &&
            Number.isFinite(previous.accuracy) &&
            previous.accuracy > 0;

          if (!previousValid || candidate.accuracy < previous.accuracy) {
            window.__zamanLokasiTerakhir = candidate;
          }
        }

        success?.(position);
      };

      const kirimError = (geoError) => {
        if (!record.aktif) return;
        error?.(geoError);
      };

      record.nativeWatchId = watchAsli(
        kirimSuccess,
        (geoError) => {
          if (!record.aktif) return;

          if (geoError?.code === 1) {
            kirimError(geoError);
            bersihkanWatch(id);
          }
          // Error 2/3 tidak dipantulkan ke Dashboard sebagai kegagalan final.
          // Jalur fast cache/network masih diberi kesempatan.
        },
        {
          ...options,
          enableHighAccuracy: true,
          maximumAge: Math.min(Number(options.maximumAge) || 0, 5000),
          timeout: Math.max(Number(options.timeout) || 12000, 12000),
        },
      );

      // Jalur cepat: cache/network diminta segera sambil GPS presisi tinggi
      // tetap berjalan paralel. Timeout pendek menjaga jalur ini tidak menahan UI.
      record.fastTimer = window.setTimeout(() => {
        if (!record.aktif) return;

        currentAsli(
          kirimSuccess,
          () => {},
          {
            ...options,
            enableHighAccuracy: false,
            maximumAge: 30000,
            timeout: 2500,
          },
        );
      }, 0);

      // Jalur cadangan kedua: bila jaringan/cache belum memberikan kandidat,
      // coba lagi dengan cache yang sedikit lebih longgar tanpa menunggu 9 detik.
      record.secondTimer = window.setTimeout(() => {
        if (!record.aktif) return;

        currentAsli(
          kirimSuccess,
          () => {},
          {
            ...options,
            enableHighAccuracy: false,
            maximumAge: 60000,
            timeout: 4000,
          },
        );
      }, 2500);

      return id;
    };

    geolocation.clearWatch = (id) => {
      const numericId = Number(id);
      if (Number.isFinite(numericId) && watchRecords.has(numericId)) {
        bersihkanWatch(numericId);
        return;
      }
      clearAsli(id);
    };

    window.__zamanGeolocationFallbackTerpasang = true;
  }
}
