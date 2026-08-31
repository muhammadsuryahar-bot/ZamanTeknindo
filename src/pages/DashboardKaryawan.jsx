import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as turf from "@turf/turf";
import {
  Camera,
  Clock3,
  History,
  FileText,
  LogOut,
  MapPin,
  RefreshCcw,
  CheckCircle2,
  ShieldCheck,
  Navigation,
  Wifi,
  WifiOff,
} from "lucide-react";

import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import {
  jumlahAntrian,
  sinkronkanAntrian,
  simpanKeAntrian,
} from "../utils/antrianOffline";

let dataProvinsiCache = null;

const TAHAP_VALID = new Set([
  "belum_masuk",
  "sudah_masuk",
  "selesai",
  "tidak_perlu_absen",
]);
const STATUS_CACHE_VERSION = 2;
const STATUS_REQUEST_TIMEOUT_MS = 8000;
const ABSENSI_REQUEST_TIMEOUT_MS = 15000;
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOAD_WIDTH = 1280;
const MAX_UPLOAD_HEIGHT = 1280;

// Cache status hari ini hanya untuk mempercepat tampilan awal.
// Verifikasi server tetap menjadi sumber kebenaran sebelum absensi dikirim.

function tanggalLokalISO() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${hari}`;
}

function kunciStatusHariIni(pengguna) {
  const identitas =
    pengguna?.id ??
    pengguna?.penggunaId ??
    pengguna?.email ??
    pengguna?.nama ??
    "pengguna";

  return `zaman-teknindo:absensi-status:v${STATUS_CACHE_VERSION}:${String(
    identitas,
  )}:${tanggalLokalISO()}`;
}

function bacaCacheStatusHariIni(pengguna) {
  try {
    const raw = localStorage.getItem(kunciStatusHariIni(pengguna));
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !TAHAP_VALID.has(data.tahap)) return null;

    return data.tahap;
  } catch (err) {
    console.warn("Cache status absensi tidak dapat dibaca:", err);
    return null;
  }
}

async function kompresFotoUntukUpload(canvas, kualitasAwal = 0.82) {
  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Ukuran foto tidak valid.");
  }

  const skala = Math.min(
    1,
    MAX_UPLOAD_WIDTH / sourceWidth,
    MAX_UPLOAD_HEIGHT / sourceHeight,
  );

  const width = Math.max(1, Math.round(sourceWidth * skala));
  const height = Math.max(1, Math.round(sourceHeight * skala));

  const canvasUpload = document.createElement("canvas");
  canvasUpload.width = width;
  canvasUpload.height = height;

  const ctx = canvasUpload.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Tidak dapat menyiapkan foto untuk upload.");
  }

  ctx.drawImage(canvas, 0, 0, width, height);

  const buatBlob = (quality) =>
    new Promise((resolve, reject) => {
      canvasUpload.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Foto gagal dikompres."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    });

  let quality = kualitasAwal;
  let blob = await buatBlob(quality);

  while (blob.size > MAX_UPLOAD_BYTES && quality > 0.45) {
    quality = Math.max(0.45, quality - 0.08);
    blob = await buatBlob(quality);
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    // Fallback terakhir: kecilkan resolusi supaya payload tetap aman.
    const fallbackCanvas = document.createElement("canvas");
    const fallbackScale = 0.75;
    fallbackCanvas.width = Math.max(1, Math.round(width * fallbackScale));
    fallbackCanvas.height = Math.max(1, Math.round(height * fallbackScale));

    const fallbackCtx = fallbackCanvas.getContext("2d", { alpha: false });
    if (!fallbackCtx) {
      throw new Error("Tidak dapat menyiapkan fallback foto.");
    }

    fallbackCtx.drawImage(
      canvasUpload,
      0,
      0,
      fallbackCanvas.width,
      fallbackCanvas.height,
    );

    blob = await new Promise((resolve, reject) => {
      fallbackCanvas.toBlob(
        (hasil) => {
          if (!hasil) {
            reject(new Error("Foto gagal dikompres."));
            return;
          }
          resolve(hasil);
        },
        "image/jpeg",
        0.45,
      );
    });
  }

  return blob;
}

function simpanCacheStatusHariIni(pengguna, tahap) {
  if (!TAHAP_VALID.has(tahap)) return;

  try {
    localStorage.setItem(
      kunciStatusHariIni(pengguna),
      JSON.stringify({
        version: STATUS_CACHE_VERSION,
        tahap,
        disimpanPada: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn("Cache status absensi tidak dapat disimpan:", err);
  }
}

async function muatDataProvinsi() {
  if (dataProvinsiCache) return dataProvinsiCache;

  const res = await fetch("/data/provinsi.json");
  if (!res.ok) throw new Error("Gagal memuat data provinsi.json");

  dataProvinsiCache = await res.json();
  return dataProvinsiCache;
}

async function cariProvinsiResmi(latitude, longitude) {
  const data = await muatDataProvinsi();
  const titik = turf.point([longitude, latitude]);

  for (const fitur of data.features) {
    try {
      if (turf.booleanPointInPolygon(titik, fitur)) {
        return fitur.properties.PROVINSI;
      }
    } catch (err) {
      // Lewati polygon yang bermasalah.
    }
  }

  return null;
}

function DialJamKerja({ tahap }) {
  const [sekarang, setSekarang] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setSekarang(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const jamDesimal = sekarang.getHours() + sekarang.getMinutes() / 60;

  // Dial menggambarkan 24 jam penuh.
  const sudutSekarang = (jamDesimal / 24) * 360;

  // Jam kerja perusahaan.
  const jamMulai = 8;
  const jamSelesai = 17;

  const persenMulai = (jamMulai / 24) * 100;
  const persenSelesai = (jamSelesai / 24) * 100;

  const warnaDial =
    tahap === "selesai"
      ? warna.sukses
      : tahap === "sudah_masuk"
        ? warna.peringatan
        : warna.aksen;

  const labelStatus =
    tahap === "selesai"
      ? "Jam kerja selesai"
      : tahap === "sudah_masuk"
        ? "Sedang menjalani jam kerja"
        : "Siap untuk absen masuk";

  return (
    <div style={dialStyles.wrapper}>
      <div style={dialStyles.header}>
        <div>
          <p style={dialStyles.eyebrow}>WAKTU KERJA</p>
          <p style={dialStyles.description}>Senin–Jumat · 08:00–17:00 WIB</p>
        </div>

        <span
          style={{
            ...dialStyles.statusBadge,
            color: warnaDial,
            background:
              tahap === "selesai"
                ? warna.suksesLembut
                : tahap === "sudah_masuk"
                  ? warna.peringatanLembut
                  : warna.aksenLembut,
          }}
        >
          {labelStatus}
        </span>
      </div>

      <div style={dialStyles.cincinWrapper}>
        <div
          style={{
            ...dialStyles.cincin,
            background: `conic-gradient(
              ${warna.garis} 0%,
              ${warna.garis} ${persenMulai}%,
              ${warnaDial} ${persenMulai}%,
              ${warnaDial} ${persenSelesai}%,
              ${warna.garis} ${persenSelesai}%,
              ${warna.garis} 100%
            )`,
          }}
        >
          <div style={dialStyles.penandaWrapper}>
            <div
              style={{
                ...dialStyles.penanda,
                transform: `rotate(${sudutSekarang}deg)`,
              }}
            >
              <div
                style={{
                  ...dialStyles.titikPenanda,
                  background: warnaDial,
                }}
              />
            </div>
          </div>

          <div style={dialStyles.lubang}>
            <span style={dialStyles.jamText}>
              {sekarang.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <span style={dialStyles.jamLabel}>WIB</span>
          </div>
        </div>
      </div>

      <div style={dialStyles.rentang}>
        <div>
          <span style={dialStyles.rentangLabel}>Mulai</span>
          <strong style={dialStyles.rentangValue}>08:00</strong>
        </div>

        <div style={dialStyles.garisRentang}>
          <span
            style={{
              ...dialStyles.progressRentang,
              background: warnaDial,
              width: `${Math.max(
                0,
                Math.min(
                  100,
                  ((jamDesimal - jamMulai) / (jamSelesai - jamMulai)) * 100,
                ),
              )}%`,
            }}
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={dialStyles.rentangLabel}>Selesai</span>
          <strong style={dialStyles.rentangValue}>17:00</strong>
        </div>
      </div>
    </div>
  );
}

const dialStyles = {
  wrapper: {
    width: "100%",
    marginBottom: 22,
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  eyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: warna.aksen,
  },

  description: {
    margin: "3px 0 0",
    fontSize: 11.5,
    color: warna.tintaSamar,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  cincinWrapper: {
    display: "flex",
    justifyContent: "center",
    margin: "4px 0 18px",
  },

  cincin: {
    width: 138,
    height: 138,
    borderRadius: "50%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  penandaWrapper: {
    position: "absolute",
    inset: 0,
  },

  penanda: {
    position: "absolute",
    inset: 0,
    display: "flex",
    justifyContent: "center",
    transformOrigin: "center",
  },

  titikPenanda: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: -1,
    boxShadow: "0 0 0 3px #fff",
  },

  lubang: {
    width: 106,
    height: 106,
    borderRadius: "50%",
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  jamText: {
    fontFamily: font.mono,
    fontSize: 22,
    fontWeight: 700,
    color: warna.tinta,
    lineHeight: 1.1,
  },

  jamLabel: {
    marginTop: 4,
    fontFamily: font.mono,
    fontSize: 9.5,
    color: warna.tintaSamar,
    letterSpacing: "0.08em",
  },

  rentang: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "end",
    gap: 10,
  },

  rentangLabel: {
    display: "block",
    marginBottom: 2,
    fontSize: 9.5,
    color: warna.tintaSamar,
  },

  rentangValue: {
    display: "block",
    fontFamily: font.mono,
    fontSize: 11.5,
    color: warna.tinta,
  },

  garisRentang: {
    height: 6,
    position: "relative",
    marginBottom: 2,
    borderRadius: 999,
    background: warna.garis,
    overflow: "hidden",
  },

  progressRentang: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    minWidth: 0,
    maxWidth: "100%",
  },
};

export default function DashboardKaryawan({ pengguna, onLogout }) {
  const navigate = useNavigate();
  const [tahap, setTahap] = useState("memuat");
  const [pengajuanHariIni, setPengajuanHariIni] = useState(null);
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoTerambil, setFotoTerambil] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [lokasi, setLokasi] = useState(null);
  const [statusLokasi, setStatusLokasi] = useState("mencari");
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [jumlahTertunda, setJumlahTertunda] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [sedangSinkron, setSedangSinkron] = useState(false);
  const [statusTerverifikasi, setStatusTerverifikasi] = useState(false);
  const [statusVerifikasiSedang, setStatusVerifikasiSedang] = useState(false);
  const [pesanSinkronisasi, setPesanSinkronisasi] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const lokasiTimerRef = useRef(null);
  const lokasiWatchRef = useRef(null);
  const lokasiSesiRef = useRef(0);
  const statusRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    document.documentElement.classList.add("karyawan-scroll-hidden");
    document.body.classList.add("karyawan-scroll-hidden");

    void ambilStatusHariIni();
    void cobaSinkronAntrian({ refreshStatus: false });

    return () => {
      mountedRef.current = false;
      document.documentElement.classList.remove("karyawan-scroll-hidden");
      document.body.classList.remove("karyawan-scroll-hidden");

      hentikanKamera();
      hentikanPelacakanLokasi();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pantau perubahan koneksi browser. Saat online kembali, antrian offline
  // langsung dicoba sinkron otomatis. Saat offline, status lokal yang valid
  // tetap bisa dipakai agar alur absensi tidak tiba-tiba menghilang.
  useEffect(() => {
    const ketikaOnline = () => {
      setIsOnline(true);
      void cobaSinkronAntrian();
    };

    const ketikaOffline = () => {
      setIsOnline(false);
      setSedangSinkron(false);
      setStatusVerifikasiSedang(false);

      const tahapTersimpan = bacaCacheStatusHariIni(pengguna);
      if (tahapTersimpan) {
        setTahap(tahapTersimpan);
      }
    };

    setIsOnline(navigator.onLine);
    window.addEventListener("online", ketikaOnline);
    window.addEventListener("offline", ketikaOffline);

    return () => {
      window.removeEventListener("online", ketikaOnline);
      window.removeEventListener("offline", ketikaOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pengguna]);

  async function cobaSinkronAntrian({ refreshStatus = true } = {}) {
    try {
      const sisa = await jumlahAntrian();
      if (!mountedRef.current) return;

      setJumlahTertunda(sisa);

      if (!navigator.onLine) {
        setSedangSinkron(false);
        if (refreshStatus) {
          await ambilStatusHariIni();
        }
        return;
      }

      if (sisa === 0) {
        setSedangSinkron(false);
        setPesanSinkronisasi("");
        if (refreshStatus) {
          await ambilStatusHariIni();
        }
        return;
      }

      setSedangSinkron(true);
      setPesanSinkronisasi("");

      const hasil = await sinkronkanAntrian({
        apiUrl: API_URL,
        getToken,
        penggunaId: pengguna.id,
      });
      const sisaTerbaru = await jumlahAntrian();

      if (!mountedRef.current) return;

      setJumlahTertunda(sisaTerbaru);

      if (hasil.berhasil > 0) {
        setPesan(
          `${hasil.berhasil} absen yang sempat tertunda berhasil terkirim.`,
        );
        setPesanSinkronisasi(
          sisaTerbaru > 0
            ? `${sisaTerbaru} absen masih menunggu sinkronisasi berikutnya.`
            : "Semua absensi tertunda sudah tersinkronkan.",
        );
        await ambilStatusHariIni();
      } else {
        setPesanSinkronisasi(
          sisaTerbaru > 0
            ? "Sinkronisasi belum berhasil. Data tetap aman di perangkat dan akan dicoba lagi otomatis."
            : "",
        );

        if (refreshStatus) {
          await ambilStatusHariIni();
        }
      }
    } catch (err) {
      console.error("Sinkronisasi offline gagal:", err);
      if (mountedRef.current) {
        setPesanSinkronisasi(
          "Sinkronisasi belum berhasil. Data tetap aman di perangkat dan akan dicoba lagi otomatis.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setSedangSinkron(false);
      }
    }
  }

  useEffect(() => {
    if (fotoTerambil) {
      const url = URL.createObjectURL(fotoTerambil);
      setFotoPreview(url);

      return () => URL.revokeObjectURL(url);
    }

    setFotoPreview("");
  }, [fotoTerambil]);

  async function ambilStatusHariIni({
    pertahankanVerifikasiSaatFallback = false,
  } = {}) {
    const requestId = ++statusRequestRef.current;
    const tahapCacheAwal = bacaCacheStatusHariIni(pengguna);

    // Cache hanya untuk mempercepat tampilan. Cache tidak dianggap sebagai
    // verifikasi server pada sesi baru.
    if (tahapCacheAwal) {
      setTahap(tahapCacheAwal);
      setLoadingStatus(false);
    } else {
      setLoadingStatus(true);
    }

    const terapkanCache = (pesanFallback = "") => {
      const tahapTersimpan = bacaCacheStatusHariIni(pengguna);

      if (!tahapTersimpan) return false;

      if (requestId !== statusRequestRef.current || !mountedRef.current) {
        return true;
      }

      setTahap(tahapTersimpan);
      if (!pertahankanVerifikasiSaatFallback) {
        setStatusTerverifikasi(false);
      }
      if (pesanFallback) setPesan(pesanFallback);
      return true;
    };

    if (!navigator.onLine) {
      const berhasilPakaiCache = terapkanCache(
        statusTerverifikasi
          ? "Sedang offline. Status terakhir yang sudah diverifikasi tetap digunakan."
          : "Sedang offline. Status terakhir yang tersimpan di perangkat ditampilkan, tetapi verifikasi server tetap diperlukan sebelum absensi.",
      );

      if (!berhasilPakaiCache && mountedRef.current) {
        setTahap("belum_terverifikasi");
        setStatusTerverifikasi(false);
        setPesan(
          "Koneksi internet tidak tersedia dan status absensi hari ini belum pernah tersimpan di perangkat. Hubungkan internet untuk memuat status absensi.",
        );
      }

      if (requestId === statusRequestRef.current && mountedRef.current) {
        setStatusVerifikasiSedang(false);
        setLoadingStatus(false);
      }
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      STATUS_REQUEST_TIMEOUT_MS,
    );

    setStatusVerifikasiSedang(true);

    try {
      const res = await fetch(`${API_URL}/absensi/status-hari-ini`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal: controller.signal,
      });

      let data = {};
      try {
        data = await res.json();
      } catch (parseError) {
        console.warn("Respons status absensi bukan JSON:", parseError);
      }

      if (requestId !== statusRequestRef.current || !mountedRef.current) {
        return;
      }

      if (!res.ok) {
        const berhasilPakaiCache = terapkanCache(
          data.pesan ||
            "Server tidak dapat memuat status terbaru. Status terakhir di perangkat digunakan.",
        );

        if (!berhasilPakaiCache) {
          setPesan(data.pesan || "Gagal memuat status absen.");
          setTahap("belum_terverifikasi");
          setStatusTerverifikasi(false);
        }
        return;
      }

      if (!TAHAP_VALID.has(data.tahap)) {
        const berhasilPakaiCache = terapkanCache(
          "Status dari server tidak dikenali. Status terakhir di perangkat digunakan.",
        );

        if (!berhasilPakaiCache) {
          setTahap("belum_terverifikasi");
          setStatusTerverifikasi(false);
          setPesan("Status absensi dari server tidak valid.");
        }
        return;
      }

      setTahap(data.tahap);
      setPengajuanHariIni(data.pengajuanIzin || null);

      simpanCacheStatusHariIni(pengguna, data.tahap);

      setStatusTerverifikasi(true);
      setPesan("");
    } catch (err) {
      console.error("Gagal memuat status absensi:", err);

      const pesanGagal =
        err?.name === "AbortError"
          ? "Server terlalu lama merespons. Status terakhir di perangkat digunakan."
          : "Server tidak dapat dihubungi. Status terakhir di perangkat digunakan.";

      const berhasilPakaiCache = terapkanCache(pesanGagal);

      if (!berhasilPakaiCache) {
        setTahap("belum_terverifikasi");
        setStatusTerverifikasi(false);
        setPesan(
          err?.name === "AbortError"
            ? "Server terlalu lama merespons. Coba muat ulang atau periksa koneksi."
            : "Gagal memuat status absen. Coba lagi atau periksa koneksi.",
        );
      }
    } finally {
      clearTimeout(timeoutId);

      if (requestId === statusRequestRef.current && mountedRef.current) {
        setStatusVerifikasiSedang(false);
        setLoadingStatus(false);
      }
    }
  }

  function hentikanStreamKamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function bukaKamera() {
    setPesan("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setPesan("Browser ini tidak mendukung akses kamera.");
      return;
    }

    hentikanStreamKamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setFotoTerambil(null);
      setLokasi(null);
      setStatusLokasi("mencari");
      setKameraAktif(true);
      ambilLokasi();
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setPesan(
          "Tidak bisa mengakses kamera. Pastikan izin kamera diberikan pada browser.",
        );
      }
    }
  }

  useEffect(() => {
    if (kameraAktif && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [kameraAktif]);

  function hentikanPelacakanLokasi() {
    lokasiSesiRef.current += 1;

    if (lokasiWatchRef.current !== null) {
      navigator.geolocation?.clearWatch(lokasiWatchRef.current);
      lokasiWatchRef.current = null;
    }

    if (lokasiTimerRef.current) {
      clearTimeout(lokasiTimerRef.current);
      lokasiTimerRef.current = null;
    }
  }

  function hentikanKamera() {
    hentikanStreamKamera();
    if (mountedRef.current) {
      setKameraAktif(false);
    }
  }

  async function ambilFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setPesan("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setPesan("Tidak dapat memproses foto kamera.");
      return;
    }

    // Kamera depan biasanya menampilkan preview mirror.
    // Foto yang dikirim kita buat normal agar tidak terbalik.
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    try {
      const blob = await kompresFotoUntukUpload(canvas);

      if (!mountedRef.current) return;

      setFotoTerambil(blob);
      // Kamera dihentikan, tetapi lokasi terakhir tetap dipertahankan
      // untuk dikirim bersama foto.
      hentikanKamera();
    } catch (err) {
      console.error("Gagal mengompres foto:", err);
      if (mountedRef.current) {
        setPesan("Foto gagal diproses. Silakan coba lagi.");
      }
    }
  }

  async function fotoUlang() {
    hentikanKamera();
    hentikanPelacakanLokasi();
    setFotoTerambil(null);
    setLokasi(null);
    setStatusLokasi("mencari");
    await bukaKamera();
  }

  async function ambilKotaKecamatanBigDataCloud(latitude, longitude) {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`,
    );

    const data = await res.json();
    const bagian = [
      data.locality,
      data.city && data.city !== data.locality ? data.city : null,
    ].filter(Boolean);

    if (bagian.length === 0) {
      throw new Error("Data BigDataCloud kosong");
    }

    return bagian.join(", ");
  }

  async function ambilDetailNominatim(latitude, longitude) {
    const detail = await ambilDetailNominatimPadaZoom(latitude, longitude, 18);

    if (!detail.jalan) {
      try {
        const detailZoomLebihLuas = await ambilDetailNominatimPadaZoom(
          latitude,
          longitude,
          17,
        );

        if (detailZoomLebihLuas.jalan) {
          return detailZoomLebihLuas;
        }
      } catch (err) {
        // Biarkan menggunakan detail sebelumnya.
      }
    }

    return detail;
  }

  async function ambilDetailNominatimPadaZoom(latitude, longitude, zoom) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=${zoom}&addressdetails=1`,
    );

    const data = await res.json();
    const a = data.address || {};

    const namaJalan =
      a.road ||
      a.pedestrian ||
      a.residential ||
      a.living_street ||
      a.footway ||
      a.cycleway ||
      a.path ||
      a.service ||
      null;

    const jalanLengkap = [namaJalan, a.house_number]
      .filter(Boolean)
      .join(" No. ");

    return {
      jalan: jalanLengkap || null,
      kotaKecamatan:
        [a.village || a.suburb, a.city || a.town || a.county]
          .filter(Boolean)
          .join(", ") || null,
    };
  }

  async function ambilAlamatDariKoordinat(latitude, longitude) {
    const [kotaKecamatanBDC, detailNominatim, provinsiResmi] =
      await Promise.all([
        ambilKotaKecamatanBigDataCloud(latitude, longitude).catch(() => null),
        ambilDetailNominatim(latitude, longitude).catch(() => null),
        cariProvinsiResmi(latitude, longitude).catch((err) => {
          console.error("Gagal mencari provinsi resmi:", err);
          return null;
        }),
      ]);

    const jalan = detailNominatim?.jalan || null;
    const kotaKecamatan =
      kotaKecamatanBDC || detailNominatim?.kotaKecamatan || null;

    const bagian = [jalan, kotaKecamatan, provinsiResmi].filter(Boolean);

    if (bagian.length === 0) {
      return `${latitude}, ${longitude}`;
    }

    return bagian.join(", ");
  }

  function ambilLokasi() {
    hentikanPelacakanLokasi();
    setStatusLokasi("mencari");

    if (!navigator.geolocation) {
      setStatusLokasi("gagal");
      return;
    }

    const sesi = lokasiSesiRef.current;
    let posisiTerbaik = null;
    let sudahSelesai = false;

    const sesiMasihAktif = () =>
      mountedRef.current && sesi === lokasiSesiRef.current;

    const selesaikan = async () => {
      if (sudahSelesai || !sesiMasihAktif()) return;

      sudahSelesai = true;

      if (lokasiWatchRef.current !== null) {
        navigator.geolocation.clearWatch(lokasiWatchRef.current);
        lokasiWatchRef.current = null;
      }

      if (lokasiTimerRef.current) {
        clearTimeout(lokasiTimerRef.current);
        lokasiTimerRef.current = null;
      }

      if (!posisiTerbaik) {
        setStatusLokasi("gagal");
        return;
      }

      const { latitude, longitude, akurasi } = posisiTerbaik;

      setLokasi({
        latitude,
        longitude,
        akurasi,
        alamat: null,
      });
      setStatusLokasi("ditemukan");

      try {
        const alamatLengkap = await ambilAlamatDariKoordinat(
          latitude,
          longitude,
        );

        if (!sesiMasihAktif()) return;

        setLokasi({
          latitude,
          longitude,
          akurasi,
          alamat: alamatLengkap,
        });
      } catch (err) {
        console.error("Reverse geocoding gagal:", err);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (posisi) => {
        if (!sesiMasihAktif()) return;

        const akurasi = Math.round(posisi.coords.accuracy);

        if (!posisiTerbaik || akurasi < posisiTerbaik.akurasi) {
          posisiTerbaik = {
            latitude: posisi.coords.latitude,
            longitude: posisi.coords.longitude,
            akurasi,
          };

          setLokasi((prev) => ({
            latitude: posisiTerbaik.latitude,
            longitude: posisiTerbaik.longitude,
            akurasi: posisiTerbaik.akurasi,
            alamat: prev?.alamat || null,
          }));

          setStatusLokasi("ditemukan");
        }

        if (akurasi <= 20) {
          void selesaikan();
        }
      },
      (error) => {
        if (!sesiMasihAktif()) return;

        console.warn("Geolocation error:", error);

        if (!posisiTerbaik) {
          setStatusLokasi("gagal");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );

    lokasiWatchRef.current = watchId;
    lokasiTimerRef.current = setTimeout(() => {
      void selesaikan();
    }, 6000);
  }

  async function kirimAbsen() {
    if (!fotoTerambil) {
      setPesan("Silakan ambil foto terlebih dahulu.");
      return;
    }

    if (!statusTerverifikasi) {
      setPesan(
        "Status absensi belum diverifikasi oleh server. Tunggu sampai verifikasi selesai, lalu coba lagi.",
      );
      return;
    }

    if (!TAHAP_VALID.has(tahap) || tahap === "selesai") {
      setPesan(
        "Status absensi belum siap untuk dikirim. Muat ulang status absensi.",
      );
      return;
    }

    setLoading(true);
    setPesan("");

    const waktuAsli = new Date().toISOString();

    const formData = new FormData();
    formData.append("foto", fotoTerambil, "absen.jpg");
    formData.append("waktuAsli", waktuAsli);

    if (lokasi) {
      formData.append("latitude", lokasi.latitude);
      formData.append("longitude", lokasi.longitude);

      const alamatDasar =
        lokasi.alamat || `${lokasi.latitude}, ${lokasi.longitude}`;
      const infoAkurasi = lokasi.akurasi
        ? ` (akurasi ±${lokasi.akurasi}m)`
        : "";

      formData.append("alamat", alamatDasar + infoAkurasi);
    }

    const endpoint = tahap === "belum_masuk" ? "masuk" : "pulang";

    const simpanOffline = async () => {
      await simpanKeAntrian({
        foto: fotoTerambil,
        latitude: lokasi?.latitude,
        longitude: lokasi?.longitude,
        alamat: formData.get("alamat"),
        waktuAsli,
        endpoint,
      });

      const sisa = await jumlahAntrian();

      if (mountedRef.current) {
        setJumlahTertunda(sisa);
        setPesan(
          "Sinyal lagi tidak stabil. Absen kamu sudah tersimpan aman di HP dan akan otomatis terkirim begitu koneksi kembali normal — tidak perlu ulangi.",
        );
        setFotoTerambil(null);
        setLokasi(null);
        setStatusLokasi("mencari");
      }
    };

    try {
      if (!navigator.onLine) {
        await simpanOffline();
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        ABSENSI_REQUEST_TIMEOUT_MS,
      );

      let res;
      try {
        res = await fetch(`${API_URL}/absensi/${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
          signal: controller.signal,
        });
      } catch (networkError) {
        console.error(networkError);
        await simpanOffline();
        return;
      } finally {
        clearTimeout(timeoutId);
      }

      let data = {};
      try {
        data = await res.json();
      } catch (parseError) {
        console.warn("Respons absensi bukan JSON:", parseError);
      }

      if (!res.ok) {
        setPesan(data.pesan || "Gagal mengirim absen.");
        return;
      }

      // POST berhasil adalah bukti server bahwa aksi absensi diterima.
      // Update state + cache langsung agar status tidak kembali ke cache lama
      // bila GET status-hari-ini sedang lambat atau gagal.
      const tahapSetelahAbsen =
        endpoint === "masuk" ? "sudah_masuk" : "selesai";
      setTahap(tahapSetelahAbsen);
      setStatusTerverifikasi(true);
      setStatusVerifikasiSedang(false);
      simpanCacheStatusHariIni(pengguna, tahapSetelahAbsen);

      setPesan(data.pesan || "Absensi berhasil dikirim.");
      setFotoTerambil(null);
      setLokasi(null);
      setStatusLokasi("mencari");
    } catch (err) {
      console.error("Pengiriman/simpan offline gagal:", err);
      setPesan(
        "Tidak bisa terhubung ke server, dan gagal menyimpan absen secara offline. Coba lagi.",
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  const judulAksi =
    tahap === "belum_masuk"
      ? "Absensi Masuk"
      : tahap === "sudah_masuk"
        ? "Absensi Pulang"
        : tahap === "selesai"
          ? "Absensi Hari Ini"
          : tahap === "tidak_perlu_absen"
            ? "Tidak Perlu Absensi"
            : "Status Absensi";

  return (
    <div className="karyawan-page" style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.brandHeader}>
            <img
              className="karyawan-header-logo"
              src={logoHorizontal}
              alt="PT. Zaman Teknindo"
              style={styles.logoHeader}
            />

            <div style={styles.userBlock}>
              <div style={styles.avatarBadge}>{inisialNama(pengguna.nama)}</div>

              <div style={{ minWidth: 0 }}>
                <p
                  className="karyawan-header-user-name"
                  style={styles.namaUser}
                >
                  {pengguna.nama}
                </p>
                <p style={styles.subNamaUser}>
                  {pengguna.jabatan || "Karyawan"}
                  {pengguna.divisi ? ` · ${pengguna.divisi}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div style={styles.headerActions} className="karyawan-header-actions">
            <button
              onClick={() => navigate("/karyawan/izin")}
              style={styles.headerButton}
              className="karyawan-header-button"
              type="button"
            >
              <FileText size={16} />
              <span>Izin</span>
            </button>

            <button
              onClick={() => navigate("/karyawan/riwayat")}
              style={styles.headerButton}
              className="karyawan-header-button"
              type="button"
            >
              <History size={16} />
              <span>Riwayat</span>
            </button>

            <button
              onClick={onLogout}
              style={styles.headerLogout}
              className="karyawan-header-button"
              type="button"
              aria-label="Keluar"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* INFO HARI INI */}
        <section style={styles.heroCard}>
          <div>
            <p style={styles.eyebrow}>SISTEM ABSENSI PT. ZAMAN TEKNINDO</p>
            <h1 style={styles.heroTitle}>{judulAksi}</h1>
            {jumlahTertunda > 0 && (
              <p style={styles.badgeTertunda}>
                <Clock3 size={13} />
                {jumlahTertunda} absen menunggu dikirim (tersimpan offline)
              </p>
            )}
            <p style={styles.heroDate}>
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div style={styles.heroBadges}>
            <div
              style={{
                ...styles.networkBadge,
                color: isOnline ? warna.sukses : warna.peringatan,
                background: isOnline
                  ? warna.suksesLembut
                  : warna.peringatanLembut,
              }}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? "Online" : "Offline"}
            </div>

            <div style={styles.securityBadge}>
              <ShieldCheck size={15} />
              Data absensi terlindungi
            </div>

            {!isOnline && (
              <div style={styles.offlineNotice}>
                Koneksi terputus. Absensi akan tetap disimpan di perangkat dan
                dikirim otomatis saat internet kembali.
              </div>
            )}

            {isOnline && sedangSinkron && jumlahTertunda > 0 && (
              <div style={styles.syncNotice}>
                <RefreshCcw size={13} />
                Sedang mengirim {jumlahTertunda} absen yang tertunda...
              </div>
            )}

            {isOnline && pesanSinkronisasi && !sedangSinkron && (
              <div style={styles.syncNotice}>
                <RefreshCcw size={13} />
                {pesanSinkronisasi}
              </div>
            )}
          </div>
        </section>

        {/* STATUS ABSEN */}
        <section style={styles.mainCard}>
          {loadingStatus && (
            <div style={styles.loadingState}>
              <Clock3 size={18} />
              <span>Memuat status absensi...</span>
            </div>
          )}

          {!loadingStatus &&
            tahap !== "memuat" &&
            tahap !== "belum_terverifikasi" &&
            tahap !== "tidak_perlu_absen" && <DialJamKerja tahap={tahap} />}

          {tahap === "belum_terverifikasi" && (
            <div style={styles.unverifiedBox}>
              <div style={styles.unverifiedIcon}>
                <WifiOff size={24} />
              </div>
              <h2 style={styles.sectionTitle}>Status absensi belum tersedia</h2>
              <p style={styles.sectionDescription}>
                Sistem belum berhasil memastikan status absensi hari ini. Untuk
                keamanan, tombol absensi tidak ditampilkan sampai status
                berhasil diverifikasi.
              </p>
              <button
                onClick={() => void ambilStatusHariIni()}
                style={styles.secondaryButton}
                type="button"
                disabled={!isOnline || loadingStatus}
              >
                <RefreshCcw size={17} />
                {loadingStatus ? "Memuat..." : "Coba Muat Status"}
              </button>
            </div>
          )}

          {tahap === "selesai" && (
            <div style={styles.successBox}>
              <div style={styles.successIcon}>
                <CheckCircle2 size={28} />
              </div>
              <h2 style={styles.sectionTitle}>Absensi Hari Ini Selesai</h2>
              <p style={styles.sectionDescription}>
                Absen masuk dan pulang kamu sudah tercatat. Terima kasih, sampai
                jumpa besok.
              </p>
            </div>
          )}

          {(tahap === "belum_masuk" || tahap === "sudah_masuk") && (
            <>
              <div style={styles.actionHeading}>
                <div>
                  <p style={styles.actionEyebrow}>
                    {tahap === "belum_masuk"
                      ? "LANGKAH 1 · ABSEN MASUK"
                      : "LANGKAH 1 · ABSEN PULANG"}
                  </p>
                  <h2 style={styles.sectionTitle}>
                    Ambil foto untuk mencatat kehadiran
                  </h2>
                  <p style={styles.statusVerificationHint}>
                    {statusVerifikasiSedang
                      ? "Memverifikasi status absensi terbaru..."
                      : statusTerverifikasi
                        ? "Status absensi sudah diverifikasi."
                        : "Status absensi belum terverifikasi."}
                  </p>
                </div>
              </div>

              {!kameraAktif && !fotoTerambil && (
                <div style={styles.startPanel}>
                  <div style={styles.cameraIconCircle}>
                    <Camera size={28} />
                  </div>
                  <p style={styles.startTitle}>Siapkan kamera</p>
                  <p style={styles.startDescription}>
                    Pastikan wajah terlihat jelas dan izinkan kamera serta
                    lokasi pada browser HP kamu.
                  </p>

                  {jumlahTertunda > 0 && (
                    <p style={styles.pendingActionNote}>
                      {jumlahTertunda} absensi masih menunggu sinkronisasi.
                      Selesaikan sinkronisasi terlebih dahulu agar tidak terjadi
                      absensi ganda.
                    </p>
                  )}

                  <button
                    onClick={() => void bukaKamera()}
                    style={styles.primaryButton}
                    type="button"
                    disabled={
                      statusVerifikasiSedang ||
                      !statusTerverifikasi ||
                      sedangSinkron ||
                      jumlahTertunda > 0
                    }
                    title={
                      jumlahTertunda > 0
                        ? "Tunggu absensi yang tersimpan offline selesai disinkronkan."
                        : undefined
                    }
                  >
                    <Camera size={18} />
                    {statusVerifikasiSedang
                      ? "Memverifikasi Status..."
                      : jumlahTertunda > 0
                        ? "Menunggu Sinkronisasi"
                        : "Buka Kamera"}
                  </button>
                </div>
              )}

              {kameraAktif && (
                <div style={styles.cameraSection}>
                  <div style={styles.cameraTopbar} className="cameraTopbar">
                    <div>
                      <p style={styles.cameraEyebrow}>KAMERA AKTIF</p>
                      <p style={styles.cameraTitle} className="cameraTitle">
                        Posisikan wajah di tengah panduan
                      </p>
                    </div>

                    <div
                      style={styles.cameraReadyBadge}
                      className="cameraReadyBadge"
                    >
                      <span style={styles.cameraReadyDot} />
                      Siap
                    </div>
                  </div>

                  <div style={styles.cameraFrame}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={styles.video}
                    />

                    <div style={styles.cameraOverlay}>
                      <div style={styles.faceGuide} />

                      <div
                        style={styles.faceGuideHint}
                        className="faceGuideHint"
                      >
                        Wajah berada di tengah
                      </div>
                    </div>

                    <div
                      style={styles.cameraLocationBadge}
                      className="cameraLocationBadge"
                    >
                      <MapPin size={12} />
                      <span>
                        {statusLokasi === "mencari" && "Mencari lokasi..."}
                        {statusLokasi === "ditemukan" && "Lokasi ditemukan"}
                        {statusLokasi === "gagal" && "Lokasi belum ditemukan"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.cameraHelpRow} className="cameraHelpRow">
                    <ShieldCheck size={14} color={warna.aksen} />
                    <span>Foto diproses untuk pencatatan absensi.</span>
                  </div>

                  <button
                    onClick={ambilFoto}
                    style={styles.primaryButton}
                    type="button"
                  >
                    <Camera size={18} />
                    Ambil Foto
                  </button>
                </div>
              )}

              {fotoTerambil && (
                <div style={styles.previewSection}>
                  <div style={styles.previewFrame}>
                    <img
                      src={fotoPreview}
                      alt="Foto absen"
                      style={styles.previewImage}
                    />
                  </div>

                  <div style={styles.locationCard}>
                    <div style={styles.locationHeader}>
                      <div style={styles.locationIcon}>
                        <MapPin size={17} />
                      </div>

                      <div style={styles.locationMain}>
                        <div style={styles.locationTitleRow}>
                          <p style={styles.locationTitle}>Lokasi Absensi</p>

                          {statusLokasi === "ditemukan" && (
                            <span
                              style={{
                                ...styles.locationAccuracyBadge,
                                ...(lokasi?.akurasi <= 50
                                  ? styles.locationAccuracyGood
                                  : lokasi?.akurasi <= 100
                                    ? styles.locationAccuracyMedium
                                    : styles.locationAccuracyWeak),
                              }}
                            >
                              {lokasi?.akurasi <= 50
                                ? "Akurat"
                                : lokasi?.akurasi <= 100
                                  ? "Cukup"
                                  : "Kurang presisi"}
                            </span>
                          )}
                        </div>

                        <p style={styles.locationStatus}>
                          {statusLokasi === "mencari" &&
                            "Sedang mencari lokasi terbaik..."}
                          {statusLokasi === "ditemukan" &&
                            (lokasi?.alamat ||
                              "Lokasi ditemukan, membaca alamat...")}
                          {statusLokasi === "gagal" &&
                            "Lokasi tidak terdeteksi. Kamu masih dapat mencoba absen."}
                        </p>
                      </div>
                    </div>

                    {statusLokasi === "ditemukan" && lokasi?.akurasi && (
                      <div style={styles.locationMeta}>
                        <span>Akurasi ±{lokasi.akurasi} meter</span>
                        <span style={styles.locationDot} />
                        <span>Koordinat berhasil diperoleh</span>
                      </div>
                    )}

                    {statusLokasi === "ditemukan" &&
                      lokasi?.latitude !== undefined &&
                      lokasi?.longitude !== undefined && (
                        <div style={styles.locationActions}>
                          <a
                            href={`https://www.google.com/maps?q=${lokasi.latitude},${lokasi.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.mapsLink}
                          >
                            <Navigation size={14} />
                            Lihat lokasi di Google Maps
                          </a>
                        </div>
                      )}
                  </div>

                  <div
                    style={styles.actionButtons}
                    className="karyawan-action-buttons"
                  >
                    <button
                      onClick={fotoUlang}
                      style={styles.secondaryButton}
                      type="button"
                      disabled={loading}
                    >
                      <RefreshCcw size={17} />
                      Foto Ulang
                    </button>

                    <button
                      onClick={kirimAbsen}
                      style={styles.primaryButton}
                      type="button"
                      disabled={loading}
                    >
                      {loading ? "Mengirim..." : "Kirim Absen"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {pesan && (
            <div style={styles.messageBox} role="alert">
              {pesan}
            </div>
          )}
        </section>

        {/* CATATAN BAWAH */}
        <div style={styles.footerNote}>
          <ShieldCheck size={14} />
          <span>
            Gunakan koneksi internet yang stabil saat mengirim absensi.
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`
        * { box-sizing: border-box; }

        .karyawan-scroll-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .karyawan-scroll-hidden::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .karyawan-button-hover:hover {
          transform: translateY(-1px);
        }

        .karyawan-page button:disabled {
          opacity: 0.58;
          cursor: not-allowed !important;
          transform: none !important;
        }

        @media (max-width: 760px) {
          .karyawan-desktop-only {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .karyawan-header-logo {
            width: 150px !important;
            margin-bottom: 10px !important;
          }

          .karyawan-header-user-name {
            font-size: 15px !important;
          }

          .karyawan-header-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr);
            gap: 7px !important;
          }

          .karyawan-header-button {
            width: 100% !important;
            min-height: 44px !important;
            padding: 8px 6px !important;
            justify-content: center !important;
            font-size: 11px !important;
            white-space: nowrap;
          }

          .karyawan-action-buttons {
            grid-template-columns: 1fr !important;
          }

          .cameraTopbar {
            align-items: flex-start;
          }

          .cameraTitle {
            max-width: 230px;
          }

          .cameraReadyBadge {
            flex-shrink: 0;
          }

          .faceGuideHint {
            transform: translate(-50%, calc(-50% + 82px));
            font-size: 9.5px;
          }

          .cameraLocationBadge {
            left: 9px;
            top: 9px;
          }

          .cameraHelpRow {
            font-size: 10.5px;
          }
        }
      `}</style>
    </div>
  );
}

function inisialNama(nama) {
  if (!nama) return "?";

  const bagian = nama.trim().split(/\s+/);

  if (bagian.length === 1) {
    return bagian[0].slice(0, 2).toUpperCase();
  }

  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#FFFFFF",
    fontFamily: font.display,
    color: warna.tinta,
    padding:
      "max(12px, env(safe-area-inset-top)) 12px max(20px, env(safe-area-inset-bottom))",
  },

  container: {
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px",
    marginBottom: 12,
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    borderRadius: 18,
    flexWrap: "wrap",
  },

  brandHeader: {
    minWidth: 0,
  },

  logoHeader: {
    width: "min(190px, 68vw)",
    height: "auto",
    maxHeight: 42,
    objectFit: "contain",
    objectPosition: "left center",
    display: "block",
    marginBottom: 12,
  },

  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  avatarBadge: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: "50%",
    background: warna.aksen,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  },

  namaUser: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: warna.tinta,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  subNamaUser: {
    margin: "2px 0 0",
    fontSize: 12,
    color: warna.tintaLembut,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  headerButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    padding: "8px 12px",
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    color: warna.tinta,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  headerLogout: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    padding: "8px 12px",
    background: "transparent",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    color: warna.bahaya,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  heroCard: {
    background: `linear-gradient(145deg, ${warna.aksenLembut}, ${warna.panel})`,
    border: `1px solid ${warna.garis}`,
    borderRadius: 18,
    padding: "18px 18px",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: warna.aksen,
  },

  heroTitle: {
    margin: "6px 0 2px",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1.1,
    fontWeight: 750,
    color: warna.tinta,
  },

  heroDate: {
    margin: 0,
    fontSize: 12.5,
    color: warna.tintaLembut,
  },

  badgeTertunda: {
    margin: "6px 0",
    fontSize: 12,
    fontWeight: 600,
    color: warna.peringatan,
    background: warna.peringatanLembut,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 20,
  },

  heroBadges: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    flexDirection: "column",
    gap: 7,
    maxWidth: 310,
  },

  networkBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${warna.garis}`,
    fontSize: 10.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  securityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.7)",
    border: `1px solid ${warna.garis}`,
    color: warna.aksen,
    fontSize: 10.5,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  offlineNotice: {
    maxWidth: 310,
    padding: "8px 10px",
    borderRadius: 11,
    background: warna.peringatanLembut,
    border: `1px solid ${warna.garis}`,
    color: warna.tintaLembut,
    fontSize: 10.5,
    lineHeight: 1.45,
    textAlign: "right",
  },

  syncNotice: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 10,
    background: warna.aksenLembut,
    border: `1px solid ${warna.garis}`,
    color: warna.aksen,
    fontSize: 10.5,
    fontWeight: 650,
    textAlign: "right",
  },

  mainCard: {
    background: warna.panel,
    borderRadius: 18,
    padding: "22px 18px 20px",
    border: `1px solid ${warna.garis}`,
    boxShadow: "0 8px 30px rgba(22,35,61,0.05)",
  },

  loadingState: {
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: warna.tintaLembut,
    fontSize: 13,
  },

  actionHeading: {
    marginBottom: 18,
    textAlign: "center",
  },

  statusVerificationHint: {
    margin: "6px 0 0",
    fontSize: 11.5,
    color: warna.tintaSamar,
  },

  actionEyebrow: {
    margin: 0,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: warna.tintaSamar,
  },

  sectionTitle: {
    margin: "5px 0 0",
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 750,
    color: warna.tinta,
  },

  sectionDescription: {
    margin: "8px auto 0",
    maxWidth: 420,
    color: warna.tintaLembut,
    fontSize: 13,
    lineHeight: 1.65,
  },

  startPanel: {
    textAlign: "center",
    padding: "18px 10px 4px",
  },

  cameraIconCircle: {
    width: 68,
    height: 68,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: warna.aksenLembut,
    color: warna.aksen,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  startTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: warna.tinta,
  },

  startDescription: {
    margin: "7px auto 16px",
    maxWidth: 430,
    fontSize: 12.5,
    lineHeight: 1.65,
    color: warna.tintaLembut,
  },

  pendingActionNote: {
    maxWidth: 430,
    margin: "-4px auto 14px",
    padding: "8px 10px",
    borderRadius: 10,
    background: warna.peringatanLembut,
    border: `1px solid ${warna.garis}`,
    color: warna.tintaLembut,
    fontSize: 11.5,
    lineHeight: 1.5,
  },

  primaryButton: {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryButton: {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    background: warna.panelAlt,
    color: warna.tinta,
    border: `1px solid ${warna.garis}`,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cameraSection: {
    width: "100%",
  },

  cameraTopbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  cameraEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: warna.aksen,
  },

  cameraTitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: warna.tintaLembut,
  },

  cameraReadyBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    padding: "5px 9px",
    borderRadius: 999,
    background: warna.suksesLembut,
    color: warna.sukses,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  cameraReadyDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: warna.sukses,
  },

  faceGuideHint: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, calc(-50% + 98px))",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.42)",
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    backdropFilter: "blur(6px)",
  },

  cameraLocationBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    maxWidth: "calc(100% - 24px)",
    minHeight: 30,
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.46)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    backdropFilter: "blur(7px)",
  },

  cameraHelpRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    margin: "10px 0 12px",
    color: warna.tintaLembut,
    fontSize: 11.5,
    textAlign: "center",
  },

  cameraFrame: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
    background: "#0B1110",
    border: `1px solid ${warna.garis}`,
    aspectRatio: "3 / 4",
    maxHeight: 560,
  },

  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transform: "scaleX(-1)",
  },

  cameraOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },

  faceGuide: {
    width: "58%",
    height: "56%",
    border: "2px solid rgba(255,255,255,0.82)",
    borderRadius: "42%",
    boxShadow: "0 0 0 999px rgba(0,0,0,0.12)",
  },

  cameraHelp: {
    margin: "9px 0 12px",
    textAlign: "center",
    color: warna.tintaLembut,
    fontSize: 11.5,
  },

  previewSection: {
    width: "100%",
  },

  previewFrame: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    background: "#0B1110",
    border: `1px solid ${warna.garis}`,
    aspectRatio: "3 / 4",
    maxHeight: 560,
  },

  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  locationCard: {
    marginTop: 12,
    padding: 14,
    background: warna.panelAlt,
    border: `1px solid ${warna.garis}`,
    borderRadius: 14,
    textAlign: "left",
  },

  locationHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },

  locationMain: {
    minWidth: 0,
    flex: 1,
  },

  locationTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },

  locationAccuracyBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "3px 7px",
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 700,
  },

  locationAccuracyGood: {
    color: warna.sukses,
    background: warna.suksesLembut,
  },

  locationAccuracyMedium: {
    color: warna.aksen,
    background: warna.aksenLembut,
  },

  locationAccuracyWeak: {
    color: warna.peringatan,
    background: warna.peringatanLembut,
  },

  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: warna.aksenLembut,
    color: warna.aksen,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  locationTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 750,
    color: warna.tinta,
  },

  locationStatus: {
    margin: "3px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: warna.tintaLembut,
    wordBreak: "break-word",
  },

  locationMeta: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    marginTop: 9,
    fontSize: 10.5,
    fontFamily: font.mono,
    color: warna.tintaSamar,
  },

  locationDot: {
    width: 3,
    height: 3,
    borderRadius: "50%",
    background: warna.tintaSamar,
  },

  locationActions: {
    marginTop: 9,
    paddingTop: 9,
    borderTop: `1px solid ${warna.garis}`,
  },

  locationWarning: {
    color: warna.peringatan,
    fontFamily: font.display,
    fontWeight: 700,
  },

  mapsLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 0,
    color: warna.aksen,
    fontSize: 11.5,
    fontWeight: 700,
    textDecoration: "none",
  },

  actionButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },

  unverifiedBox: {
    textAlign: "center",
    padding: "6px 4px 12px",
    maxWidth: 520,
    margin: "0 auto",
  },

  unverifiedIcon: {
    width: 64,
    height: 64,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: warna.peringatanLembut,
    color: warna.peringatan,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  successBox: {
    textAlign: "center",
    padding: "4px 0 10px",
  },

  successIcon: {
    width: 64,
    height: 64,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: warna.suksesLembut,
    color: warna.sukses,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  messageBox: {
    marginTop: 14,
    padding: "11px 12px",
    borderRadius: 12,
    borderLeft: `3px solid ${warna.aksen}`,
    background: warna.panelAlt,
    color: warna.tinta,
    fontSize: 12.5,
    lineHeight: 1.55,
    textAlign: "left",
  },

  footerNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "14px 4px 4px",
    color: warna.tintaSamar,
    fontSize: 10.5,
    textAlign: "center",
  },
};
