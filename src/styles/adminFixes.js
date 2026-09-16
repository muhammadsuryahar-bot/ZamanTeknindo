/* Perbaikan UI Admin yang terisolasi. Tidak mengubah komponen/logic halaman lain. */
if (typeof document !== "undefined" && !document.getElementById("zaman-admin-fixes-style")) {
  const style = document.createElement("style");
  style.id = "zaman-admin-fixes-style";
  style.textContent = `
    /* Rekap: toolbar tanggal harus ikut layout, bukan menimpa statistik. */
    .admin-rekap-toolbar {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      width: 100% !important;
      min-height: 64px !important;
      margin: 0 0 14px !important;
      padding: 10px 12px !important;
      box-sizing: border-box !important;
      z-index: 5 !important;
      transform: none !important;
    }
    .main-area-admin:has(.statGrid) .statGrid {
      padding-top: 0 !important;
    }
    .admin-rekap-toolbar + .main-area-admin {
      min-height: calc(100svh - 96px) !important;
      height: auto !important;
    }
    .admin-belum-panel {
      position: absolute !important;
      top: 78px !important;
      right: 0 !important;
    }

    /* REKAP: satu vertical scroll saja di document. Main dan tabel tidak boleh
       menjadi scroll container vertikal kedua. */
    #root > div:has(.main-area-admin:has(.tableHint)) {
      height: auto !important;
      min-height: 100svh !important;
      overflow: visible !important;
      align-items: flex-start !important;
    }
    #root > div:has(.main-area-admin:has(.tableHint)) .main-area-admin {
      height: auto !important;
      min-height: 100svh !important;
      overflow: visible !important;
      overflow-y: visible !important;
      overflow-x: hidden !important;
    }
    #root > div:has(.main-area-admin:has(.tableHint)) .main-area-admin .tableWrap {
      height: auto !important;
      max-height: none !important;
      overflow-x: auto !important;
      overflow-y: visible !important;
    }
    #root > div:has(.main-area-admin:has(.tableHint)) .main-area-admin .tableWrap table {
      height: auto !important;
    }
    @media (min-width: 861px) {
      #root > div:has(.main-area-admin:has(.tableHint)) .admin-sidebar {
        position: sticky !important;
        top: 0 !important;
        height: 100svh !important;
        max-height: 100svh !important;
        overflow-y: auto !important;
        align-self: flex-start !important;
      }
    }
    @media (max-width: 860px) {
      #root > div:has(.main-area-admin:has(.tableHint)) .main-area-admin {
        min-height: 100svh !important;
      }
      #root > div:has(.main-area-admin:has(.tableHint)) .admin-sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        overflow-y: auto !important;
      }
    }

    @media (max-width: 760px) {
      .admin-rekap-toolbar {
        min-height: 96px !important;
        margin-bottom: 12px !important;
        padding: 9px 10px !important;
      }
      .admin-rekap-toolbar + .main-area-admin {
        min-height: calc(100svh - 112px) !important;
      }
      .admin-belum-panel {
        top: 102px !important;
        right: 10px !important;
        left: 10px !important;
        width: auto !important;
      }
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
