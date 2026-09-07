import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { pasangPenerjemahSesiKedaluwarsa, getToken, getPenggunaLogin, API_URL } from './utils/api.js'
import { jumlahAntrian, sinkronkanAntrian, verifikasiDanBersihkanAntrian } from './utils/antrianOffline.js'

// Bersihkan cache runtime lama yang dipakai versi PWA sebelumnya.
if (typeof window !== 'undefined' && 'caches' in window) {
  void caches.delete('aset-halaman-lazy-v2').catch(() => {})
}

// Recovery khusus dynamic import/chunk PWA.
// Jangan menangkap semua window.error karena error kamera/GPS/JS lain dapat
// tertangkap secara keliru lalu memindahkan halaman pengguna.
if (typeof window !== 'undefined' && !window.__pwaChunkRecoveryTerpasang) {
  const KEY = 'zaman-teknindo:pwa-chunk-recovery'
  const BATAS_MS = 30_000

  const cobaPulihkanChunk = () => {
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
    cobaPulihkanChunk()
  })

  window.__pwaChunkRecoveryTerpasang = true
}

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

// Recovery antrean dilakukan hanya pada momen yang memang relevan:
// saat koneksi kembali dan saat PWA/tab kembali terlihat. Dashboard sendiri
// tetap menampilkan status dan kontrol sinkronisasi untuk pengguna. Tidak ada
// polling 30 detik global yang terus-menerus membebani backend.
if (typeof window !== 'undefined' && !window.__zamanOfflineRecoveryTerpasang) {
  const jalankanRecoveryOffline = async () => {
    if (!navigator.onLine) return
    const pengguna = getPenggunaLogin()
    const token = getToken()
    if (!pengguna || !token) return

    try {
      const sebelum = await jumlahAntrian(pengguna.id)
      if (sebelum <= 0) return

      await sinkronkanAntrian({ apiUrl: API_URL, getToken, penggunaId: pengguna.id })
      await verifikasiDanBersihkanAntrian({
        apiUrl: API_URL,
        getToken,
        penggunaId: pengguna.id,
      })
    } catch (error) {
      console.warn('Recovery antrean offline belum berhasil:', error)
    }
  }

  const ketikaOnline = () => { void jalankanRecoveryOffline() }
  const ketikaTerlihat = () => {
    if (document.visibilityState === 'visible') void jalankanRecoveryOffline()
  }

  window.addEventListener('online', ketikaOnline)
  document.addEventListener('visibilitychange', ketikaTerlihat)
  window.__zamanOfflineRecoveryTerpasang = true
  void jalankanRecoveryOffline()
}

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
