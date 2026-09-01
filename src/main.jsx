import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { pasangPenerjemahSesiKedaluwarsa } from './utils/api.js'

// Dipasang SEKALI di sini, sebelum aplikasi mulai render, supaya berlaku
// untuk semua pemanggilan fetch() dari halaman manapun.
pasangPenerjemahSesiKedaluwarsa()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Muat chunk halaman penting saat browser sedang senggang. Ini tidak menahan
// first paint/login, tetapi membuat perpindahan ke Dashboard, Gaji, Arsip,
// dan Edit Karyawan terasa jauh lebih cepat setelah halaman pertama terbuka.
function prefetchHalamanPenting() {
  void import('./pages/DashboardAdmin.jsx')
  void import('./pages/DashboardKaryawanStabil.jsx')
  void import('./pages/PengaturanGaji.jsx')
  void import('./pages/AdminGajiMassal.jsx')
  void import('./pages/AdminArsip.jsx')
  void import('./pages/AdminEditKaryawan.jsx')
}

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetchHalamanPenting, { timeout: 1500 })
  } else {
    window.setTimeout(prefetchHalamanPenting, 1200)
  }
}
