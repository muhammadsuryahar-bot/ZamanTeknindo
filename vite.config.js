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
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "favicon.svg"],
      manifest: {
        name: "Absensi PT. Zaman Teknindo",
        short_name: "Absensi Zaman",
        description:
          "Aplikasi absensi & penggajian karyawan PT. Zaman Teknindo",
        theme_color: "#0B6E45",
        background_color: "#F4F5F7",
        display: "standalone",
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],

        // Bersihkan cache Workbox lama yang tidak lagi direferensikan
        // oleh service worker baru agar chunk yang sudah dihapus tidak
        // terus dipanggil oleh browser/PWA lama.
        cleanupOutdatedCaches: true,

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
            // Chunk halaman lazy-load disimpan setelah benar-benar diminta.
            // Cache name dibuat berversi agar cache lama tidak terus dipakai.
            urlPattern: /\.(?:js|css)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "aset-halaman-lazy-v2",
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
