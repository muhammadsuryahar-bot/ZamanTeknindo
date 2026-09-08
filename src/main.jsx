import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
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
  const BATAS_MS = 5 * 60 * 1000

  const bersihkanCacheDanServiceWorker = async () => {
    try {
      if ('caches' in window) {
        const namaCache = await caches.keys()
        await Promise.all(
          namaCache
            .filter((nama) => /workbox|precache|aset-halaman/i.test(nama))
            .map((nama) => caches.delete(nama)),
        )
      }
    } catch (error) {
      console.warn('Pembersihan cache PWA gagal:', error)
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrasi = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrasi.map((item) => item.unregister()))
      }
    } catch (error) {
      console.warn('Pembersihan service worker PWA gagal:', error)
    }
  }

  const cobaPulihkanChunk = async () => {
    try {
      const sebelumnya = Number(sessionStorage.getItem(KEY) || 0)
      const sekarang = Date.now()
      if (sebelumnya && sekarang - sebelumnya < BATAS_MS) return
      sessionStorage.setItem(KEY, String(sekarang))

      await bersihkanCacheDanServiceWorker()
      window.location.reload()
    } catch (error) {
      console.warn('Recovery chunk PWA gagal:', error)
      try {
        window.location.reload()
      } catch {
        // Biarkan halaman tetap hidup bila reload juga tidak tersedia.
      }
    }
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void cobaPulihkanChunk()
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
  }, 5 * 60 * 1000)
}

// PWA memakai mode prompt: service worker boleh menyiapkan versi baru di
// belakang layar, tetapi reload hanya dilakukan ketika aman sehingga tidak
// memutus kamera/absensi yang sedang berlangsung.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let updatePWA = null
  let pembaruanTertunda = false
  let penjagaPembaruan = null

  const kameraMasihAktif = () => {
    const videoElements = document.querySelectorAll('.cameraSection video')

    for (const video of videoElements) {
      if (!(video instanceof HTMLVideoElement)) continue
      const stream = video.srcObject
      if (!(stream instanceof MediaStream)) continue
      if (stream.getVideoTracks().some((track) => track.readyState === 'live')) {
        return true
      }
    }

    return false
  }

  const terapkanPembaruanJikaAman = () => {
    if (!pembaruanTertunda || typeof updatePWA !== 'function') return

    // Jangan reload ketika kamera masih live. Setelah kamera dilepas,
    // pembaruan diterapkan otomatis tanpa perlu karyawan memasang ulang PWA.
    if (kameraMasihAktif()) {
      if (penjagaPembaruan !== null) return
      penjagaPembaruan = window.setInterval(() => {
        if (!kameraMasihAktif()) {
          if (penjagaPembaruan !== null) {
            window.clearInterval(penjagaPembaruan)
            penjagaPembaruan = null
          }
          pembaruanTertunda = false
          void updatePWA()
        }
      }, 1000)
      return
    }

    pembaruanTertunda = false
    if (penjagaPembaruan !== null) {
      window.clearInterval(penjagaPembaruan)
      penjagaPembaruan = null
    }
    void updatePWA()
  }

  updatePWA = registerSW({
    immediate: true,
    onNeedRefresh() {
      pembaruanTertunda = true
      terapkanPembaruanJikaAman()
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      const periksaUpdatePWA = async () => {
        if (!navigator.onLine) return
        try {
          await registration.update()
        } catch (error) {
          console.warn('Pemeriksaan update PWA belum berhasil:', error)
        }
      }

      window.addEventListener('online', () => {
        void periksaUpdatePWA()
        terapkanPembaruanJikaAman()
      })
      window.addEventListener('pageshow', () => {
        void periksaUpdatePWA()
        terapkanPembaruanJikaAman()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void periksaUpdatePWA()
          terapkanPembaruanJikaAman()
        }
      })

      void periksaUpdatePWA()
    },
  })

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  if (standalone && navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => {})
  }
}

// Hardening geolocation untuk HP yang GPS-nya butuh waktu memperoleh fix.
// DashboardKaryawan tetap menjadi pemilik lifecycle utamanya, sedangkan
// adapter ini hanya menambahkan fallback lokasi jaringan/cache agar tidak
// bergantung penuh pada satu provider lokasi.
if (typeof window !== 'undefined' && !window.__zamanGeolocationFallbackTerpasang) {
  const geolocation = navigator.geolocation
  const watchAsli = geolocation?.watchPosition?.bind(geolocation)
  const currentAsli = geolocation?.getCurrentPosition?.bind(geolocation)
  const clearAsli = geolocation?.clearWatch?.bind(geolocation)

  if (geolocation && watchAsli && currentAsli && clearAsli) {
    const watchRecords = new Map()
    let nextId = 1

    const bersihkanWatch = (id) => {
      const record = watchRecords.get(id)
      if (!record) return

      record.aktif = false
      if (record.fallbackTimer) window.clearTimeout(record.fallbackTimer)
      if (record.networkTimer) window.clearTimeout(record.networkTimer)
      if (record.nativeWatchId !== null) clearAsli(record.nativeWatchId)
      watchRecords.delete(id)
    }

    geolocation.watchPosition = (success, error, options = {}) => {
      const id = nextId++
      const record = {
        aktif: true,
        nativeWatchId: null,
        fallbackTimer: null,
        networkTimer: null,
      }
      watchRecords.set(id, record)

      const kirimSuccess = (position) => {
        if (!record.aktif) return
        window.__zamanLokasiTerakhir = {
          latitude: Number(position?.coords?.latitude),
          longitude: Number(position?.coords?.longitude),
          accuracy: Number(position?.coords?.accuracy),
          pada: Date.now(),
        }
        success?.(position)
      }

      const kirimError = (geoError) => {
        if (!record.aktif) return
        error?.(geoError)
      }

      record.nativeWatchId = watchAsli(
        kirimSuccess,
        (geoError) => {
          if (!record.aktif) return
          if (geoError?.code === 1) {
            kirimError(geoError)
            bersihkanWatch(id)
            return
          }
          // Error 2/3 tidak langsung menghentikan watch. Fallback network/cache
          // tetap diberi kesempatan mencari koordinat.
        },
        {
          ...options,
          enableHighAccuracy: true,
          maximumAge: Math.min(Number(options.maximumAge) || 0, 10000),
          timeout: Math.max(Number(options.timeout) || 12000, 12000),
        },
      )

      // Coba lokasi network/cache lebih awal, tanpa menunggu GPS presisi tinggi.
      record.fallbackTimer = window.setTimeout(() => {
        if (!record.aktif) return
        currentAsli(
          kirimSuccess,
          () => {},
          {
            ...options,
            enableHighAccuracy: false,
            maximumAge: 30000,
            timeout: 8000,
          },
        )
      }, 1200)

      // Bila HP baru keluar dari mode hemat baterai / lokasi baru diaktifkan,
      // lakukan satu percobaan kedua menjelang batas waktu utama.
      record.networkTimer = window.setTimeout(() => {
        if (!record.aktif) return
        currentAsli(
          kirimSuccess,
          () => {},
          {
            ...options,
            enableHighAccuracy: false,
            maximumAge: 60000,
            timeout: 7000,
          },
        )
      }, 9000)

      return id
    }

    geolocation.clearWatch = (id) => {
      const numericId = Number(id)
      if (Number.isFinite(numericId) && watchRecords.has(numericId)) {
        bersihkanWatch(numericId)
        return
      }
      clearAsli(id)
    }

    window.__zamanGeolocationFallbackTerpasang = true
  }
}

// Pada versi DashboardKaryawan saat ini, status "kamera siap" disimpan di ref
// agar callback kamera tidak memicu render ulang. Atribut disabled pada tombol
// Ambil Foto ikut berasal dari ref tersebut sehingga React tidak selalu merender
// ulang ketika preview kamera benar-benar sudah siap.
// Guard di bawah sekarang juga mewajibkan koordinat sudah didapat sebelum foto
// boleh diambil. Ini mencegah race: foto diambil -> tracker lokasi langsung
// dihentikan -> koordinat tidak pernah sempat masuk -> tombol Kirim Absen macet.
if (typeof window !== 'undefined' && !window.__kameraAmbilFotoGuardTerpasang) {
  const rapikanStatusLokasi = () => {
    const cameraSections = document.querySelectorAll('.cameraSection')
    const adaKamera = cameraSections.length > 0

    if (!adaKamera) {
      window.__zamanLokasiSesiAktif = false
      window.__zamanLokasiSudahDitemukan = false
      return
    }

    const lokasiTerakhir = window.__zamanLokasiTerakhir
    const lokasiMasihFresh =
      lokasiTerakhir &&
      Number.isFinite(lokasiTerakhir.latitude) &&
      Number.isFinite(lokasiTerakhir.longitude) &&
      Number.isFinite(lokasiTerakhir.accuracy) &&
      Date.now() - lokasiTerakhir.pada <= 120000

    if (!window.__zamanLokasiSesiAktif) {
      window.__zamanLokasiSesiAktif = true
      window.__zamanLokasiSudahDitemukan = Boolean(lokasiMasihFresh)
    }

    for (const section of cameraSections) {
      const video = section.querySelector('video')
      const tombol = Array.from(section.querySelectorAll('button[type="button"]')).find((button) =>
        button.textContent?.includes('Ambil Foto'),
      )

      if (!(tombol instanceof HTMLButtonElement)) continue

      const videoSiap =
        video instanceof HTMLVideoElement &&
        video.videoWidth > 0 &&
        video.videoHeight > 0

      const lokasiSiap = window.__zamanLokasiSudahDitemukan === true
      tombol.disabled = !videoSiap || !lokasiSiap
      tombol.title =
        !videoSiap
          ? 'Menyiapkan kamera...'
          : !lokasiSiap
            ? 'Menunggu lokasi perangkat ditemukan...'
            : ''
    }
  }

  const interval = window.setInterval(rapikanStatusLokasi, 250)
  document.addEventListener('visibilitychange', rapikanStatusLokasi)
  window.addEventListener('pageshow', rapikanStatusLokasi)
  window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true })
  window.__kameraAmbilFotoGuardTerpasang = true
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
