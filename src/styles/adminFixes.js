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
