// Token desain dipakai bersama di semua halaman, supaya konsisten
// dan gampang diubah dari satu tempat kalau nanti mau reskin.
//
// `aksen` diambil langsung dari warna logo PT. Zaman Teknindo (hijau pinus,
// #0B6E45) -- bukan warna template. Merah dari wordmark logo sengaja TIDAK
// dipakai sebagai warna aksi UI, karena merah di sistem ini sudah bermakna
// "Alpha/bahaya"; motif merah brand cukup hidup lewat logo saja.

export const warna = {
  latar: "#F4F5F7",
  panel: "#FFFFFF",
  panelAlt: "#EDEFF3",
  garis: "#DADFE6",
  tinta: "#16233D",
  tintaLembut: "#5B6472",
  tintaSamar: "#8A93A3",
  aksen: "#0B6E45",
  aksenGelap: "#08402A",
  aksenLembut: "#E1F0E8",
  sukses: "#2F855A",
  suksesLembut: "#E4F3EA",
  peringatan: "#C77800",
  peringatanLembut: "#FBEDD9",
  bahaya: "#C0392B",
  bahayaLembut: "#FBE7E4",
};

export const font = {
  display: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export const bayangan = "0 1px 2px rgba(22,35,61,0.04), 0 8px 24px rgba(22,35,61,0.06)";

// Skala ukuran font -- SENGAJA cuma 6 pilihan (bukan angka bebas kayak
// 13.5/14/14.5 dst). Dipakai berulang di semua halaman supaya hierarki
// teksnya konsisten dan kerasa "dirancang", bukan ditambal komponen per
// komponen dengan angka acak.
export const teks = {
  kecil: 11,      // label kecil, keterangan tambahan, badge
  badan: 13,      // teks isi/body biasa -- paling sering dipakai
  subjudul: 15,   // sub-judul di dalam kartu
  judul: 18,      // judul halaman/section
  besar: 24,      // angka statistik besar
  hero: 32,       // judul utama (halaman Login, dsb)
};

// Skala jarak (padding/margin/gap) -- kelipatan 4px, konvensi umum di
// design system (Material, Apple HIG, Tailwind) supaya jarak antar elemen
// terasa beraturan, bukan angka acak yang bedanya nyaris tak kerasa.
export const jarak = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Skala sudut kartu/tombol -- cuma 3 pilihan.
export const radius = { kecil: 6, sedang: 10, besar: 16 };

// Patch UI Admin yang sengaja ditempatkan di design-system layer agar tidak
// menyentuh logic halaman. Toolbar Rekap tidak lagi menimpa statistik, dan
// form kantor tetap sederhana untuk Admin.
if (typeof document !== "undefined" && !document.getElementById("zaman-admin-stability-fix")) {
  const style = document.createElement("style");
  style.id = "zaman-admin-stability-fix";
  style.textContent = `
    /* Toolbar tanggal menjadi bagian dari layout, bukan overlay di atas card. */
    .admin-rekap-toolbar {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      width: 100% !important;
      min-height: 64px !important;
      margin: 0 !important;
      padding: 10px 14px !important;
      border-radius: 0 0 12px 12px !important;
      opacity: 1 !important;
      visibility: visible !important;
      transform: none !important;
      pointer-events: auto !important;
      box-sizing: border-box !important;
      z-index: 8 !important;
    }

    .admin-rekap-toolbar + div {
      height: calc(100svh - 64px) !important;
      min-height: 0 !important;
    }

    /* Hapus kompensasi padding lama yang membuat ruang kosong/overlap. */
    .main-area-admin:has(.statGrid) .statGrid {
      padding-top: 0 !important;
    }

    /* Form Kantor/Homebase: Admin tidak perlu memasukkan koordinat. */
    .main-area-admin section:has(input[placeholder*="Homebase Bandung"]) input[inputmode="decimal"],
    .main-area-admin section:has(input[placeholder*="Homebase Bandung"]) label:has(input[inputmode="decimal"]) {
      display: none !important;
    }

    .main-area-admin section:has(input[placeholder*="Homebase Bandung"]) .formGrid::after {
      content: "Koordinat lokasi ditentukan otomatis dari alamat saat disimpan.";
      display: block;
      grid-column: 1 / -1;
      color: #8A93A3;
      font-size: 11px;
      line-height: 1.45;
    }

    .main-area-admin section:has(input[placeholder*="Homebase Bandung"]) .formActions > button:first-child {
      display: none !important;
    }

    @media (max-width: 760px) {
      .admin-rekap-toolbar {
        min-height: 96px !important;
        padding: 9px 10px !important;
      }
      .admin-rekap-toolbar + div {
        height: calc(100svh - 96px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Intersep hanya request penyimpanan master Kantor/Homebase. Admin tetap
// mengetik alamat biasa; sebelum request dikirim, koordinat kantor dicari
// otomatis. Request endpoint lain sama sekali tidak disentuh.
if (typeof window !== "undefined" && !window.__zamanOfficeLocationBridge) {
  const fetchAsli = window.fetch.bind(window);
  window.__zamanOfficeLocationBridge = true;

  const geocodeAlamatKantor = async (alamat) => {
    const teks = String(alamat || "").trim();
    if (!teks) throw new Error("Alamat kantor wajib diisi.");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    try {
      const query = encodeURIComponent(`${teks}, Indonesia`);
      const response = await fetchAsli(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=id&q=${query}`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      if (!response.ok) throw new Error(`Alamat kantor tidak berhasil dicari (HTTP ${response.status}).`);
      const data = await response.json();
      const hasil = Array.isArray(data) ? data[0] : null;
      const latitude = Number(hasil?.lat);
      const longitude = Number(hasil?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Alamat kantor belum ditemukan. Lengkapi nama jalan, kecamatan, kota, dan provinsi.");
      }
      return { latitude: latitude.toFixed(7), longitude: longitude.toFixed(7) };
    } finally {
      window.clearTimeout(timer);
    }
  };

  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    const pathname = (() => {
      try { return new URL(requestUrl, window.location.origin).pathname; } catch { return requestUrl; }
    })();

    const isOfficeWrite = method !== "GET" && method !== "HEAD" && /\/admin\/kantor(?:\/[^/]+)?$/.test(pathname);
    if (!isOfficeWrite || typeof init?.body !== "string") return fetchAsli(input, init);

    let payload;
    try { payload = JSON.parse(init.body); } catch { return fetchAsli(input, init); }
    if (!payload || typeof payload !== "object" || !String(payload.alamat || "").trim()) return fetchAsli(input, init);

    const koordinat = await geocodeAlamatKantor(payload.alamat);
    const nextInit = { ...init, body: JSON.stringify({ ...payload, ...koordinat }) };
    return fetchAsli(input, nextInit);
  };
}
`;
}
