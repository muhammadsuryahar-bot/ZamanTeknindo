import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // basicSsl() bikin Vite otomatis nyalain HTTPS pakai sertifikat "self-signed"
  // (bikin sendiri, bukan dari otoritas resmi kayak Let's Encrypt). Ini WAJIB
  // supaya kamera/lokasi bisa diakses browser HP -- browser modern nge-block
  // getUserMedia (akses kamera) di halaman non-HTTPS kecuali localhost.
  // Efeknya: pas pertama buka di HP, browser bakal kasih peringatan
  // "Koneksi tidak aman/Not secure" -- itu WAJAR karena sertifikatnya
  // "buatan sendiri", bukan tanda ada yang salah. Tinggal klik
  // "Advanced" -> "Proceed anyway" / "Lanjutkan" sekali saja.
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
