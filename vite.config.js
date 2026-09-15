import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // DashboardKaryawan hanya memakai point() dan booleanPointInPolygon().
      // Jangan kirim seluruh @turf/turf ke browser karena memperberat bundle awal.
      "@turf/turf": path.resolve(__dirname, "src/utils/turfLite.js"),
    },
  },

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
      registerType: "prompt",
      includeAssets: ["favicon.png", "favicon.svg"],
      manifest: {
        id: "/karyawan",
        name: "Absensi PT. Zaman Teknindo",
        short_name: "Absensi Zaman",
        description:
          "Aplikasi absensi & penggajian karyawan PT. Zaman Teknindo",
        theme_color: "#0B6E45",
        background_color: "#F4F5F7",
        display: "standalone",
        display_override: ["standalone"],
        orientation: "portrait",
        start_url: "/karyawan",
        scope: "/",
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
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [],
      },
    }),
  ],

  build: {
    target: "es2019",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Turf penuh sudah dipangkas via alias; pertahankan aturan umum
          // supaya dependencies tidak menumpuk ke entry utama.
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },

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
