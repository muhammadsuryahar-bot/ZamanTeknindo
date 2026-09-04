import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { pasangPenerjemahSesiKedaluwarsa } from './utils/api.js'

// ============================================================
// PWA / CAMERA RECOVERY
// ============================================================
// Bersihkan cache runtime lama yang dipakai versi PWA sebelumnya.
if (typeof window !== 'undefined' && 'caches' in window) {
  void caches.delete('aset-halaman-lazy-v2').catch(() => {})
}

// Batasi permintaan kamera agar UI tidak menggantung selamanya ketika
// browser/OS sedang gagal membuka camera device.
if (typeof window !== 'undefined' && !window.__zamanCameraRecoveryTerpasang) {
  const mediaDevices = navigator.mediaDevices
  const getUserMediaAsli = mediaDevices?.getUserMedia?.bind(mediaDevices)

  if (getUserMediaAsli) {
    mediaDevices.getUserMedia = (constraints) => {
      let kedaluwarsa = false
      let timer = null

      const streamPromise = getUserMediaAsli(constraints).then((stream) => {
        if (kedaluwarsa) {
          stream.getTracks().forEach((track) => track.stop())
          throw new DOMException('Permintaan kamera melewati batas waktu.', 'AbortError')
        }
        return stream
      })

      const timeoutPromise = new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          kedaluwarsa = true
          reject(new DOMException('Permintaan kamera melewati batas waktu.', 'AbortError'))
        }, 12_000)
      })

      return Promise.race([streamPromise, timeoutPromise]).finally(() => {
        if (timer) window.clearTimeout(timer)
      })
    }
  }

  window.__zamanCameraRecoveryTerpasang = true
}

// Pastikan preview video mencoba play lagi setelah metadata/canplay tersedia.
// Ini membantu perangkat yang berhasil membuka stream tetapi preview awalnya
// belum berjalan.
if (typeof window !== 'undefined' && !window.__zamanVideoRecoveryTerpasang) {
  const pasangRecoveryVideo = (video) => {
    if (!(video instanceof HTMLVideoElement) || video.__zamanVideoRecovery) return
    video.__zamanVideoRecovery = true

    const pastikanPlay = () => {
      if (!video.srcObject || !video.paused) return
      void video.play().catch(() => {})
    }

    video.addEventListener('loadedmetadata', pastikanPlay)
    video.addEventListener('canplay', pastikanPlay)
    video.addEventListener('emptied', () => {
      if (video.srcObject) window.setTimeout(pastikanPlay, 100)
    })
  }

  document.querySelectorAll('video').forEach(pasangRecoveryVideo)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node instanceof HTMLVideoElement) pasangRecoveryVideo(node)
        node.querySelectorAll?.('video').forEach(pasangRecoveryVideo)
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.__zamanVideoRecoveryTerpasang = true
}

// Recovery global untuk kasus dynamic import/chunk lama gagal dimuat.
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

  window.addEventListener('error', (event) => {
    const pesan = String(event?.error?.message || event?.message || '')
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(pesan)) {
      cobaPulihkanChunk()
    }
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
