import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // basicSsl() bikin Vite otomatis nyalain HTTPS pakai sertifikat "self-signed"
  // (bikin sendiri, bukan dari otoritas resmi kayak Let's Encrypt). Ini WAJIB
  // supaya kamera/lokasi bisa diakses browser HP -- browser modern nge-block
  // getUserMedia (akses kamera) di halaman non-HTTPS kecuali localhost.
  // Efeknya: pas pertama buka di HP, browser bakal kasih peringatan
  // "Koneksi tidak aman/Not secure" -- itu WAJAR karena sertifikatnya
  // "buatan sendiri", bukan tanda ada yang salah. Tinggal klik
  // "Advanced" -> "Proceed anyway" / "Lanjutkan" sekali saja.
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // otomatis pakai versi baru begitu ada update, tanpa harus uninstall-install ulang
      includeAssets: ["favicon.png", "favicon.svg"],
      manifest: {
        name: "Absensi PT. Zaman Teknindo",
        short_name: "Absensi Zaman",
        description:
          "Aplikasi absensi & penggajian karyawan PT. Zaman Teknindo",
        theme_color: "#0B6E45", // warna status bar HP pas app dibuka, hijau brand
        background_color: "#F4F5F7", // warna layar splash pas app baru dibuka
        display: "standalone", // ini yang bikin ke-buka tanpa address bar, kayak app asli
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache aset statis (JS/CSS/gambar) supaya app-nya kebuka cepat &
        // tetap bisa dibuka (meski data-nya belum tentu update) walau sinyal
        // lagi jelek. TIDAK meng-cache request ke /api atau /uploads --
        // data absen/gaji harus selalu fresh dari server, jangan sampai
        // karyawan lihat data basi karena ke-cache.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],

        // Halaman-halaman yang di-lazy-load (lihat React.lazy() di
        // App.jsx) SENGAJA dikeluarkan dari precache di sini. Kalau
        // tidak, Service Worker bakal langsung mengunduh semuanya
        // begitu app pertama dibuka -- membatalkan tujuan lazy-load
        // (yang justru ingin menunda unduhan sampai benar-benar
        // dibutuhkan). Sebagai gantinya, file-file ini di-cache lewat
        // runtimeCaching di bawah: baru disimpan SETELAH benar-benar
        // diminta browser (jadi tetap bisa dipakai offline nantinya,
        // tanpa bikin boros kuota di awal).
        globIgnores: [
          "**/DashboardAdmin-*.js",
          "**/DashboardKaryawan-*.js",
          "**/PengajuanIzin-*.js",
          "**/RiwayatAbsensi-*.js",
          "**/GantiPassword-*.js",
          "**/Daftar-*.js",
        ],

        runtimeCaching: [
          {
            // Tangkap file JS/CSS apa saja yang di-request browser tapi
            // belum ada di precache (termasuk semua chunk halaman di
            // atas). StaleWhileRevalidate: langsung pakai versi cache
            // kalau ada (cepat), sambil diam-diam cek versi terbaru di
            // belakang layar untuk kunjungan berikutnya.
            urlPattern: /\.(?:js|css)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "aset-halaman-lazy",
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,

    allowedHosts: [".ngrok-free.dev"],

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
