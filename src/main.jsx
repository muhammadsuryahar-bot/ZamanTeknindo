import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { pasangPenerjemahSesiKedaluwarsa } from './utils/api.js'

// Dipasang SEKALI di sini, sebelum aplikasi mulai render, supaya berlaku
// untuk semua pemanggilan fetch() dari halaman manapun.
pasangPenerjemahSesiKedaluwarsa()

// Sinkronisasi rekap Admin ke tanggal yang sedang dipilih di AdminShell.
// DashboardAdmin adalah komponen lama yang tetap meminta endpoint
// /admin/rekap-hari-ini tanpa query tanggal. Interceptor ini memastikan
// request tersebut tetap membawa tanggal yang dipilih, tanpa mengganti
// struktur halaman atau membuat endpoint/berkas baru.
if (typeof window !== 'undefined' && !window.__adminRekapFetchTerpasang) {
  const fetchAsli = window.fetch.bind(window)

  window.fetch = (input, init) => {
    const urlAsli =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : ''

    const tanggalRekap = window.__adminTanggalRekap
    const perluSinkron =
      tanggalRekap &&
      urlAsli.includes('/admin/rekap-hari-ini') &&
      !/[?&]tanggal=/.test(urlAsli)

    if (!perluSinkron) return fetchAsli(input, init)

    const separator = urlAsli.includes('?') ? '&' : '?'
    const urlBaru = `${urlAsli}${separator}tanggal=${encodeURIComponent(tanggalRekap)}`

    if (typeof input === 'string') {
      return fetchAsli(urlBaru, init)
    }

    if (input instanceof Request) {
      return fetchAsli(new Request(urlBaru, input), init)
    }

    return fetchAsli(urlBaru, init)
  }

  window.__adminRekapFetchTerpasang = true
}

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
  void import('./pages/DashboardKaryawan.jsx')
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
