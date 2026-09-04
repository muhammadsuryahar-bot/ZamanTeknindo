import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { pasangPenerjemahSesiKedaluwarsa } from './utils/api.js'

// Bersihkan cache runtime lama yang dibuat versi PWA sebelumnya.
// Versi lama memakai cache StaleWhileRevalidate untuk lazy chunk dan dapat
// meninggalkan bundle yang tidak cocok dengan index terbaru.
if (typeof window !== 'undefined' && 'caches' in window) {
  void caches.delete('aset-halaman-lazy-v2').catch(() => {})
}

// Recovery global untuk kasus dynamic import/chunk lama gagal dimuat.
// Ini mencegah layar putih permanen setelah PWA menerima versi baru.
if (typeof window !== 'undefined' && !window.__pwaChunkRecoveryTerpasang) {
  const KEY = 'zaman-teknindo:pwa-chunk-recovery'
  const BATAS_MS = 30_000

  const cobaPulihkanChunk = (alasan = 'chunk') => {
    try {
      const sebelumnya = Number(sessionStorage.getItem(KEY) || 0)
      const sekarang = Date.now()
      if (sebelumnya && sekarang - sebelumnya < BATAS_MS) return
      sessionStorage.setItem(KEY, String(sekarang))
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    cobaPulihkanChunk('vite-preload')
  })

  window.addEventListener('error', (event) => {
    const pesan = String(event?.error?.message || event?.message || '')
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(pesan)) {
      cobaPulihkanChunk('window-error')
    }
  })

  window.__pwaChunkRecoveryTerpasang = true
}

// Setelah aplikasi berhasil berjalan cukup lama, izinkan recovery otomatis
// dipakai kembali pada kegagalan chunk berikutnya.
if (typeof window !== 'undefined') {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem('zaman-teknindo:pwa-chunk-recovery')
    } catch {
      // Abaikan bila sessionStorage tidak tersedia.
    }
  }, 30_000)
}

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
